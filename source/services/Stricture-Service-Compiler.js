/**
 * Stricture - Compiler Service
 *
 * MicroDDL state machine parser. Reads .mddl files line-by-line and produces
 * three JSON output files:
 *   - MeadowModel.json          (tables only)
 *   - MeadowModel-Extended.json (tables + authorization + endpoints + pict config)
 *   - MeadowModel-PICT.json     (PICT UI configuration only)
 *
 * Replaces the legacy Stricture-Compile.js functionality.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libFS = require('fs');
const libPath = require('path');
const libLineReader = require('line-by-line');

const libFableServiceBase = require('fable').ServiceProviderBase;

// Load the default state for meadow and pict configuration settings
const _DefaultAPIDefinitions = require('../defaults/Meadow-Endpoints-Definition-Defaults.js');
const _DefaultAPISecurity = require('../defaults/Meadow-Endpoints-Security-Defaults.js');
const _DefaultPict = require('../defaults/Pict-Configuration-Defaults.js');

/**
 * Generate a Meadow schema object from a single table's compiled model data.
 *
 * Maps column DataTypes to Meadow schema types, builds a DefaultObject with
 * sane initial values, and produces a JsonSchema for validation.
 *
 * @param {Object} pModelData - A single table object from the compiled model
 *
 * @return {Object} A Meadow-compatible schema definition
 */
function generateMeadowSchema(pModelData)
{
	let tmpTable = pModelData;
	let tmpPrimaryKey = 'ID' + tmpTable.TableName;

	// Find the actual primary key column
	for (let j = 0; j < tmpTable.Columns.length; j++)
	{
		if (tmpTable.Columns[j].DataType === 'ID')
		{
			tmpPrimaryKey = tmpTable.Columns[j].Column;
		}
	}

	let tmpModel = {
		Scope: tmpTable.TableName,
		DefaultIdentifier: tmpPrimaryKey,
		Domain: (typeof (tmpTable.Domain) === 'undefined') ? 'Default' : tmpTable.Domain,
		Schema: [],
		DefaultObject: {},
		JsonSchema: {
			title: tmpTable.TableName,
			type: 'object',
			properties: {},
			required: []
		},
		Authorization: {}
	};

	for (let j = 0; j < tmpTable.Columns.length; j++)
	{
		let tmpColumnName = tmpTable.Columns[j].Column;
		let tmpColumnType = tmpTable.Columns[j].DataType;
		let tmpColumnSize = tmpTable.Columns[j].hasOwnProperty('Size') ? tmpTable.Columns[j].Size : 'Default';

		let tmpSchemaEntry = { Column: tmpColumnName, Type: 'Default' };

		// Map DataType to Meadow schema type and set default values
		switch (tmpColumnType)
		{
			case 'ID':
				tmpSchemaEntry.Type = 'AutoIdentity';
				tmpModel.DefaultObject[tmpColumnName] = 0;
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
				tmpModel.JsonSchema.required.push(tmpColumnName);
				break;
			case 'GUID':
				tmpSchemaEntry.Type = 'AutoGUID';
				tmpModel.DefaultObject[tmpColumnName] = '0x0000000000000000';
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
				break;
			case 'ForeignKey':
				tmpSchemaEntry.Type = 'Integer';
				tmpModel.DefaultObject[tmpColumnName] = 0;
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
				tmpModel.JsonSchema.required.push(tmpColumnName);
				break;
			case 'Numeric':
				tmpSchemaEntry.Type = 'Integer';
				tmpModel.DefaultObject[tmpColumnName] = 0;
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
				break;
			case 'Decimal':
				tmpSchemaEntry.Type = 'Decimal';
				tmpModel.DefaultObject[tmpColumnName] = 0.0;
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'number', size: tmpColumnSize };
				break;
			case 'String':
			case 'Text':
				tmpSchemaEntry.Type = 'String';
				tmpModel.DefaultObject[tmpColumnName] = '';
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
				break;
			case 'DateTime':
				tmpSchemaEntry.Type = 'DateTime';
				tmpModel.DefaultObject[tmpColumnName] = null;
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
				break;
			case 'Boolean':
				tmpSchemaEntry.Type = 'Boolean';
				tmpModel.DefaultObject[tmpColumnName] = false;
				tmpModel.JsonSchema.properties[tmpColumnName] = { type: 'boolean', size: tmpColumnSize };
				break;
		}

		// Mark magic columns that branch by name (change tracking columns)
		switch (tmpColumnName)
		{
			case 'CreateDate':
				tmpSchemaEntry.Type = 'CreateDate';
				break;
			case 'CreatingIDUser':
				tmpSchemaEntry.Type = 'CreateIDUser';
				break;
			case 'UpdateDate':
				tmpSchemaEntry.Type = 'UpdateDate';
				break;
			case 'UpdatingIDUser':
				tmpSchemaEntry.Type = 'UpdateIDUser';
				break;
			case 'DeleteDate':
				tmpSchemaEntry.Type = 'DeleteDate';
				break;
			case 'DeletingIDUser':
				tmpSchemaEntry.Type = 'DeleteIDUser';
				break;
			case 'Deleted':
				tmpSchemaEntry.Type = 'Deleted';
				break;
		}

		tmpSchemaEntry.Size = tmpColumnSize;
		tmpModel.Schema.push(tmpSchemaEntry);
	}

	if (Array.isArray(tmpTable.Indices) && tmpTable.Indices.length > 0)
	{
		tmpModel.Indices = JSON.parse(JSON.stringify(tmpTable.Indices));
	}

	return tmpModel;
}

/**
 * Service that compiles MicroDDL files into Stricture JSON models.
 *
 * MicroDDL is a simple schema definition language using symbol prefixes:
 *   - `!`  Table definition
 *   - `@`  Primary numeric identity column
 *   - `%`  GUID column
 *   - `~`  Foreign key column
 *   - `$`  String column (with optional size)
 *   - `#`  Numeric integer column
 *   - `.`  Decimal column
 *   - `*`  Text (blob) column
 *   - `&`  DateTime column
 *   - `^`  Boolean column
 *   - `>`  Table description
 *   - `"`  Column description
 *   - `+`  Named index (e.g. `+IX_User_Email Email`)
 *   - `+!` Named unique index (e.g. `+!AK_User_Username UserName`)
 *   - `->` Join definition
 *   - `=>` Table-level join definition
 */
class StrictureServiceCompiler extends libFableServiceBase
{
	/**
	 * @param {Object} pFable - The Fable Framework instance
	 * @param {Object} pOptions - The options for the service
	 * @param {String} pServiceHash - The hash of the service
	 */
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		/** @type {any} */
		this.log;
		/** @type {string} */
		this.UUID;

		this.serviceType = 'StrictureCompiler';
	}

	/**
	 * Parse complex property syntax from a MicroDDL line within an extended stanza.
	 *
	 * Handles three line types:
	 *   - Title template: `(Some Title Template)` -> sets TitleTemplate
	 *   - Property: `:PropertyName=value` -> sets PropertyName/PropertyValue
	 *   - ValueSet: `ColumnName key:value key:value` -> parses key-value pairs
	 *
	 * @param {string} pLine - The trimmed line to parse
	 * @param {Object} pEntries - The object to populate with parsed data
	 *
	 * @return {string} The line type: 'Title', 'Property', or 'ValueSet'
	 */
	parseComplexProperties(pLine, pEntries)
	{
		let tmpKey = '';
		let tmpValue = '';
		let tmpToken = 0;
		let tmpPrefix = true;
		let tmpInQuotes = false;
		let tmpLineType = 'ValueSet';

		if ((pLine.charAt(0) === '(') && (pLine.charAt(pLine.length - 1) === ')'))
		{
			// Title stanza — an underscore/lodash template
			tmpLineType = 'Title';
			pEntries.TitleTemplate = pLine.substr(1, pLine.length - 2);
		}
		else if (pLine.charAt(0) === ':')
		{
			// Property assignment stanza
			tmpLineType = 'Property';
			let tmpAssignmentLocation = pLine.indexOf('=');
			pEntries.PropertyName = pLine.substr(1, tmpAssignmentLocation - 1).trim();
			pEntries.PropertyValue = pLine.substr(tmpAssignmentLocation + 1, pLine.length - tmpAssignmentLocation).trim();
			if (pEntries.PropertyValue === 'false')
			{
				pEntries.PropertyValue = false;
			}
			if (pEntries.PropertyValue === 'true')
			{
				pEntries.PropertyValue = true;
			}
		}
		else
		{
			// Parse key:value pairs separated by spaces
			for (let i = 0; i < pLine.length; i++)
			{
				let tmpCharacter = pLine.charAt(i);

				if (!tmpInQuotes && (tmpCharacter === ' '))
				{
					if ((tmpToken > 0) && (tmpKey !== ''))
					{
						pEntries[tmpKey] = tmpValue;
					}
					tmpToken++;
					tmpKey = '';
					tmpValue = '';
					tmpPrefix = true;
				}
				else if (tmpCharacter === '"')
				{
					tmpInQuotes = !tmpInQuotes;
				}
				else if (tmpPrefix && (tmpCharacter === ':'))
				{
					tmpPrefix = false;
				}
				else if (tmpPrefix)
				{
					tmpKey += tmpCharacter;
				}
				else
				{
					tmpValue += tmpCharacter;
				}
			}
			if ((tmpToken > 0) && (tmpKey !== ''))
			{
				pEntries[tmpKey] = tmpValue;
			}
		}

		return tmpLineType;
	}

	/**
	 * Read and parse a single MicroDDL file using a line-by-line state machine.
	 *
	 * Populates `pStrictureModel` (Tables, TablesSequence, Authorization, Endpoints, Pict)
	 * from the parsed DDL. Handles include directives by recursively parsing referenced files.
	 *
	 * @param {Object} pStrictureModel - The model state to populate
	 * @param {Object} pParserState - The shared parser state (line count, current scope, etc.)
	 * @param {string} pFileName - Path to the .mddl file
	 * @param {function} fComplete - Callback invoked on completion (no error parameter)
	 */
	readMicroDDLFile(pStrictureModel, pParserState, pFileName, fComplete)
	{
		let tmpSelf = this;
		let tmpIncludeFiles = [];

		/**
		 * Initialize a table scope in the model if it does not yet exist.
		 *
		 * @param {string} pScopeHash - The table name / scope key
		 */
		let initializeScope = (pScopeHash) =>
		{
			if (!pStrictureModel.Tables.hasOwnProperty(pScopeHash))
			{
				pStrictureModel.Tables[pScopeHash] = {
					TableName: pScopeHash,
					Domain: pParserState.CurrentDomain,
					Columns: [],
					Indices: [],
					Description: ''
				};
				pStrictureModel.TablesSequence.push(pScopeHash);
				// Fresh copies of the endpoint and authorization defaults
				pStrictureModel.Endpoints = JSON.parse(JSON.stringify(_DefaultAPIDefinitions));
				pStrictureModel.Authorization[pScopeHash] = JSON.parse(JSON.stringify(_DefaultAPISecurity));
			}
		};

		/**
		 * Initialize a PICT scope for a table if it does not yet exist.
		 *
		 * @param {string} pScopeHash - The table name / scope key
		 */
		let initializePictScope = (pScopeHash) =>
		{
			if (!pStrictureModel.Pict.hasOwnProperty(pScopeHash))
			{
				pStrictureModel.Pict[pScopeHash] = JSON.parse(JSON.stringify(_DefaultPict));
			}
		};

		// Parse the file line-by-line using the line-by-line module
		let tmpLineReader = new libLineReader(pFileName);

		tmpLineReader.on('error',
			(pError) =>
			{
				tmpSelf.log.error('>>> Error reading MicroDDL file.');
				tmpSelf.log.error(`  > ${pError}`);
			}
		);

		tmpLineReader.on('line',
			(pLine) =>
			{
				tmpLineReader.pause();

				pParserState.LineCount++;
				let tmpLine = pLine.trim();
				let tmpLineSplit = tmpLine.split(' ');

				if (tmpLine === '')
				{
					// Blank line resets the stanza and scope
					pParserState.StanzaType = 'None';
					pParserState.CurrentScope = 'None';
				}
				// ── Outside any stanza: look for stanza openers ──
				else if (pParserState.CurrentScope === 'None')
				{
					if (tmpLine.charAt(0) === '!')
					{
						// Table schema stanza
						pParserState.StanzaType = 'TableSchema';
						pParserState.CurrentScope = tmpLineSplit[0].substring(1);
						initializeScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins table stanza: ${pParserState.CurrentScope}`);
						pParserState.TableCount++;
					}
					else if (tmpLine.charAt(0) === '/')
					{
						// Comment line — skip
					}
					else if ((tmpLineSplit[0] === '[Domain') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						// Domain change directive
						pParserState.CurrentDomain = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} changes the domain: ${pParserState.CurrentDomain}`);
					}
					else if ((tmpLineSplit[0] === '[Authorization') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						pParserState.StanzaType = 'ExtendedStanza-Authorization';
						pParserState.CurrentScope = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						initializeScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins authorizor stanza: ${pParserState.CurrentScope}`);
					}
					else if ((tmpLineSplit[0] === '[PICT-Create') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						pParserState.StanzaType = 'ExtendedStanza-Pict-Create';
						pParserState.CurrentScope = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						initializePictScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins PICT Create stanza: ${pParserState.CurrentScope}`);
					}
					else if ((tmpLineSplit[0] === '[PICT-List') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						pParserState.StanzaType = 'ExtendedStanza-Pict-List';
						pParserState.CurrentScope = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						initializePictScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins PICT List stanza: ${pParserState.CurrentScope}`);
					}
					else if ((tmpLineSplit[0] === '[PICT-Record') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						pParserState.StanzaType = 'ExtendedStanza-Pict-Record';
						pParserState.CurrentScope = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						initializePictScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins PICT Record stanza: ${pParserState.CurrentScope}`);
					}
					else if ((tmpLineSplit[0] === '[PICT-Update') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						pParserState.StanzaType = 'ExtendedStanza-Pict-Update';
						pParserState.CurrentScope = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						initializePictScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins PICT Update stanza: ${pParserState.CurrentScope}`);
					}
					else if ((tmpLineSplit[0] === '[PICT-Delete') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						pParserState.StanzaType = 'ExtendedStanza-Pict-Delete';
						pParserState.CurrentScope = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						initializePictScope(pParserState.CurrentScope);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} begins PICT Delete stanza: ${pParserState.CurrentScope}`);
					}
					else if ((tmpLineSplit[0] === '[Include') && (tmpLine.charAt(tmpLine.length - 1) === ']'))
					{
						// Include directive — queue the referenced file for processing after this one
						let tmpIncludeFile = tmpLineSplit[1].substring(0, tmpLineSplit[1].length - 1);
						tmpSelf.log.info(`  > Line #${pParserState.LineCount} references include stanza: ${tmpIncludeFile}`);
						let tmpIncludeFilePath = libPath.dirname(pFileName) + '/' + tmpIncludeFile;
						tmpSelf.log.info(`  > Adding file ${tmpIncludeFilePath} to includes.`);
						tmpIncludeFiles.push(tmpIncludeFilePath);
					}
					else
					{
						// Lines outside stanzas that don't start with ! are unrecognized
						if ((tmpLine.charAt(0) !== '!'))
						{
							tmpSelf.log.warn(`  > Compiler ignoring line #${pParserState.LineCount} because it is not within a table stanza.`);
							tmpSelf.log.warn(`    Content: ${tmpLine}`);
						}
					}
				}
				// ── Authorization stanza ──
				else if (pParserState.StanzaType === 'ExtendedStanza-Authorization')
				{
					if (tmpLineSplit.length < 3)
					{
						tmpSelf.log.warn(`  > Compiler ignoring extended line #${pParserState.LineCount} because it does not have enough tokens.`);
					}
					else
					{
						if (tmpLineSplit[1] === '*')
						{
							// Wildcard role definition — apply to all roles
							tmpSelf.log.info(`  > Setting custom authorization for entity ${pParserState.CurrentScope} - wildcard role definition for ${tmpLineSplit[0]}:`);
							for (let roleKey in pStrictureModel.Authorization[pParserState.CurrentScope])
							{
								if (roleKey !== '__DefaultAPISecurity')
								{
									tmpSelf.log.info(`  > Setting custom authorization for entity ${pParserState.CurrentScope} - ${roleKey}.${tmpLineSplit[0]} => ${tmpLineSplit[2]} [FROM ${pStrictureModel.Authorization[pParserState.CurrentScope][roleKey][tmpLineSplit[0]]}]`);
									pStrictureModel.Authorization[pParserState.CurrentScope][roleKey][tmpLineSplit[0]] = tmpLineSplit[2];
								}
							}
						}
						else if (typeof (pStrictureModel.Authorization[pParserState.CurrentScope][tmpLineSplit[1]]) === 'undefined')
						{
							tmpSelf.log.info(`  > Custom authorizer line ignored: ${tmpLine}`);
						}
						else
						{
							tmpSelf.log.info(`  > Setting custom authorization for entity ${pParserState.CurrentScope} - ${tmpLineSplit[1]}.${tmpLineSplit[0]} => ${tmpLineSplit[2]} [FROM ${pStrictureModel.Authorization[pParserState.CurrentScope][tmpLineSplit[1]][tmpLineSplit[0]]}]`);
							pStrictureModel.Authorization[pParserState.CurrentScope][tmpLineSplit[1]][tmpLineSplit[0]] = tmpLineSplit[2];
						}
					}
				}
				// ── PICT extended stanza ──
				else if (pParserState.StanzaType.substr(0, 20) === 'ExtendedStanza-Pict-')
				{
					let tmpPictOperation = pParserState.StanzaType.substr(20, 10);
					let tmpLineTypeCharacter = tmpLine.charAt(0);

					if (tmpLineTypeCharacter === '#')
					{
						tmpSelf.log.info(`  > Adding Pict ${tmpPictOperation} Section Heading Definition: ${tmpLine}`);
						let tmpEntry = { Column: tmpLine.substring(1), Type: 'SectionHeading' };
						pStrictureModel.Pict[pParserState.CurrentScope][tmpPictOperation].Columns.push(tmpEntry);
					}
					else
					{
						let tmpEntry = { Column: tmpLineSplit[0] };
						let tmpLineType = tmpSelf.parseComplexProperties(tmpLine, tmpEntry);

						if (tmpLineType === 'Title')
						{
							tmpSelf.log.info(`  > Setting the title for the ${pParserState.CurrentScope} -> ${tmpPictOperation} display`);
							pStrictureModel.Pict[pParserState.CurrentScope][tmpPictOperation].Title = tmpEntry.TitleTemplate;
						}
						else if (tmpLineType === 'Property')
						{
							tmpSelf.log.info(`  > Setting the ${tmpEntry.PropertyName} property for the ${pParserState.CurrentScope} -> ${tmpPictOperation} display`);
							pStrictureModel.Pict[pParserState.CurrentScope][tmpPictOperation][tmpEntry.PropertyName] = tmpEntry.PropertyValue;
						}
						else
						{
							tmpSelf.log.info(`  > Adding Pict ${tmpPictOperation} column for entity ${pParserState.CurrentScope} ${JSON.stringify(tmpEntry)}`);
							pStrictureModel.Pict[pParserState.CurrentScope][tmpPictOperation].Columns.push(tmpEntry);
						}
					}
				}
				// ── Table schema stanza — parse column definitions ──
				else if (pParserState.StanzaType === 'TableSchema')
				{
					let tmpLineTypeCharacter = tmpLine.charAt(0);
					let tmpLineType = 'Comment';
					let tmpColumn = {};

					/*
					 * MicroDDL Column Symbols:
					 *   !TABLE   @PrimaryID   %GUID   ~ForeignKey
					 *   $String  #Numeric     .Decimal
					 *   *Text    &DateTime    ^Boolean
					 *   >Description  "ColumnDescription
					 */

					let tmpColumnName = pParserState.CurrentScope + '_UnknownColumn';
					if (tmpLineSplit[0].length > 1)
					{
						tmpColumnName = tmpLineSplit[0].substring(1);
					}

					// Check if the column already exists (for adding descriptions to existing columns)
					let tmpExisting = pStrictureModel.Tables[pParserState.CurrentScope].Columns.find(
						(pElement) => { return pElement.Column === tmpColumnName; });
					if (typeof (tmpExisting) !== 'undefined')
					{
						tmpColumn = tmpExisting;
					}
					tmpColumn.Column = tmpColumnName;

					switch (tmpLineTypeCharacter)
					{
						case '@':
							// Primary identity column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'ID';
							break;

						case '%':
							// GUID column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'GUID';
							tmpColumn.Size = '36';
							if ((tmpLineSplit.length > 1) && (tmpLineSplit[1].match(/^[0-9]+$/) !== null))
							{
								tmpColumn.Size = tmpLineSplit[1];
							}
							break;

						case '~':
							// Foreign key column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'ForeignKey';
							break;

						case '$':
							// String column with optional size
							tmpLineType = 'Column';
							tmpColumn.DataType = 'String';
							tmpColumn.Size = '64';
							if ((tmpLineSplit.length > 1) && (tmpLineSplit[1].match(/^[0-9]+$/) !== null))
							{
								tmpColumn.Size = tmpLineSplit[1];
							}
							break;

						case '#':
							// Numeric integer column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'Numeric';
							tmpColumn.Size = 'int';
							if ((tmpLineSplit.length > 1) && (tmpLineSplit[1].match(/^[0-9]+$/) !== null))
							{
								tmpColumn.Size = tmpLineSplit[1];
							}
							break;

						case '.':
							// Decimal column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'Decimal';
							tmpColumn.Size = '10,3';
							if ((tmpLineSplit.length > 1) && (tmpLineSplit[1].match(/^[0-9,]+$/) !== null))
							{
								tmpColumn.Size = tmpLineSplit[1];
							}
							break;

						case '*':
							// Text (blob) column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'Text';
							break;

						case '&':
							// DateTime column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'DateTime';
							break;

						case '^':
							// Boolean column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'Boolean';
							break;

						case '{':
							// JSON column
							tmpLineType = 'Column';
							tmpColumn.DataType = 'JSON';
							// If a second token exists that is not a join arrow and not purely numeric,
							// it is a JSONProxy storage column name
							if ((tmpLineSplit.length > 1) && (tmpLineSplit[1] !== '->') && (tmpLineSplit[1].match(/^[0-9]+$/) === null))
							{
								tmpColumn.DataType = 'JSONProxy';
								tmpColumn.StorageColumn = tmpLineSplit[1];
							}
							break;

						case '"':
							// Column description (attached to previous column by name)
							tmpLineType = 'ColumnDescription';
							tmpColumn.Description = tmpLine.substring(tmpLineSplit[0].length + 1);
							tmpColumn.Description = tmpColumn.Description.substring(0, tmpColumn.Description.length - 1);
							break;

						case '+':
						{
							// Named index. Syntax:
							//   +IndexName Col1[, Col2, ...]    regular
							//   +!IndexName Col1[, Col2, ...]   unique
							tmpLineType = 'Index';
							let tmpUnique = (tmpLine.charAt(1) === '!');
							let tmpNameStart = tmpUnique ? 2 : 1;
							let tmpIndexName = tmpLineSplit[0].substring(tmpNameStart);
							let tmpIndexColumns = [];
							if (tmpLine.length > tmpLineSplit[0].length)
							{
								let tmpRest = tmpLine.substring(tmpLineSplit[0].length).trim();
								tmpIndexColumns = tmpRest.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
							}
							if (tmpIndexName.length === 0)
							{
								tmpSelf.log.warn(`  > Index declaration on line #${pParserState.LineCount} is missing a name; skipping.`);
							}
							else if (tmpIndexColumns.length === 0)
							{
								tmpSelf.log.warn(`  > Index [${tmpIndexName}] on line #${pParserState.LineCount} has no columns; skipping.`);
							}
							else
							{
								pStrictureModel.Tables[pParserState.CurrentScope].Indices.push({
									Name: tmpIndexName,
									Columns: tmpIndexColumns,
									Unique: tmpUnique
								});
							}
							break;
						}

						case '>':
							// Table description
							tmpLineType = 'TableDescription';
							let tmpDescription = tmpLine.substring(1);
							if (pStrictureModel.Tables[pParserState.CurrentScope].Description.length > 0)
							{
								pStrictureModel.Tables[pParserState.CurrentScope].Description += '\n\n';
							}
							pStrictureModel.Tables[pParserState.CurrentScope].Description += tmpDescription;
							break;
					}

					// Detect column-level join definition (->)
					if (tmpLineSplit.length > 2)
					{
						if (tmpLineSplit[tmpLineSplit.length - 2] === '->')
						{
							tmpColumn.Join = tmpLineSplit[tmpLineSplit.length - 1];
						}
					}

					// Detect table-level join definition (=>)
					if (tmpLineSplit.length > 2)
					{
						if (tmpLineSplit[tmpLineSplit.length - 2] === '=>')
						{
							tmpColumn.TableJoin = tmpLineSplit[tmpLineSplit.length - 1];
						}
					}

					if (tmpLineType === 'Column')
					{
						pStrictureModel.Tables[pParserState.CurrentScope].Columns.push(tmpColumn);
					}
					if (tmpLineType === 'Comment')
					{
						if (tmpLine !== '')
						{
							tmpSelf.log.info(`  > Comment on line #${pParserState.LineCount}: ${tmpLine}`);
						}
					}
				}

				tmpLineReader.resume();
			}
		);

		tmpLineReader.on('end',
			() =>
			{
				tmpSelf.log.info(`  > Compilation complete for ${pFileName}`);

				if (tmpIncludeFiles.length > 0)
				{
					tmpSelf.log.info(`>>> Processing ${tmpIncludeFiles.length} include files`);

					// Process include files sequentially using fable's Utility.eachLimit
					let tmpIndex = 0;
					let processNextInclude = () =>
					{
						if (tmpIndex >= tmpIncludeFiles.length)
						{
							return fComplete();
						}
						let tmpIncludeFile = tmpIncludeFiles[tmpIndex];
						tmpIndex++;
						tmpSelf.log.info(`--> Processing ${tmpIncludeFile} include file`);
						tmpSelf.readMicroDDLFile(pStrictureModel, pParserState, tmpIncludeFile, processNextInclude);
					};
					processNextInclude();
				}
				else
				{
					fComplete();
				}
			}
		);
	}

	/**
	 * Compile a MicroDDL file to Stricture JSON model files.
	 *
	 * This is the main entry point for the compiler. It:
	 *   1. Initializes the Stricture model state
	 *   2. Parses the MicroDDL file (and any includes)
	 *   3. Writes three JSON output files: base model, extended model, PICT model
	 *   4. Stores the compiled model on `this.fable.AppData.Stricture`
	 *
	 * @param {string} pFileName - Path to the input .mddl file
	 * @param {string} pOutputLocation - Output directory path (must exist or be created)
	 * @param {string} pOutputFileName - Base output file name (e.g. 'MeadowModel')
	 * @param {function} fCallback - Callback invoked as fCallback(pError) on completion
	 */
	compileFile(pFileName, pOutputLocation, pOutputFileName, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};
		let tmpSelf = this;

		let tmpStrictureModelFile = pOutputLocation + pOutputFileName + '.json';
		let tmpStrictureModelExtendedFile = pOutputLocation + pOutputFileName + '-Extended.json';
		let tmpStrictureModelPICTFile = pOutputLocation + pOutputFileName + '-PICT.json';

		// Initialize the model state
		let tmpStrictureModel = {
			Tables: {},
			TablesSequence: [],
			Authorization: {},
			Endpoints: {},
			Pict: {}
		};

		// Initialize the parser state machine
		let tmpParserState = {
			LineCount: 0,
			TableCount: 0,
			ColumnCount: 0,
			InStanza: false,
			CurrentScope: 'None',
			StanzaType: 'None',
			CurrentDomain: 'Default'
		};

		// Ensure the output directory exists
		require('mkdirp').sync(pOutputLocation);

		tmpSelf.log.info('--> Compiling MicroDDL to JSON');
		tmpSelf.log.info(`  > Input file:  ${pFileName}`);
		tmpSelf.log.info(`  > Output file: ${tmpStrictureModelFile}`);
		tmpSelf.log.info(`  > Extended Output file: ${tmpStrictureModelExtendedFile}`);
		tmpSelf.log.info('  > Reading DDL File(s)');

		// Parse the MicroDDL file(s)
		tmpSelf.readMicroDDLFile(tmpStrictureModel, tmpParserState, pFileName,
			() =>
			{
				let tmpAnticipate = tmpSelf.fable.instantiateServiceProviderWithoutRegistration('Anticipate');

				// Stage 1: Write the base model JSON
				tmpAnticipate.anticipate(
					(fStageComplete) =>
					{
						tmpSelf.log.info('  > Metacompiling the Model');
						try
						{
							libFS.writeFileSync(tmpStrictureModelFile, JSON.stringify({ Tables: tmpStrictureModel.Tables }, null, 4));
							tmpSelf.log.info('  > Model JSON Successfully Written');
							return fStageComplete();
						}
						catch (pError)
						{
							tmpSelf.log.error(`  > Error writing out model JSON: ${pError}`);
							return fStageComplete(pError);
						}
					});

				// Stage 2: Auto-generate inline Meadow schemas for each table
				tmpAnticipate.anticipate(
					(fStageComplete) =>
					{
						tmpSelf.log.info(' Auto-generating inline meadow schemas');
						for (let tmpTableKey in tmpStrictureModel.Tables)
						{
							let tmpTable = tmpStrictureModel.Tables[tmpTableKey];
							let tmpSchema = generateMeadowSchema(tmpTable);
							tmpStrictureModel.Tables[tmpTableKey].MeadowSchema = tmpSchema;
						}
						return fStageComplete();
					});

				// Stage 3: Write the extended model JSON (includes Authorization, Endpoints, Pict)
				tmpAnticipate.anticipate(
					(fStageComplete) =>
					{
						tmpSelf.log.info('  > Compiling the Extended Model');
						// Decorate tables with MeadowSchema in JsonSchema
						if (typeof (tmpStrictureModel) === 'object')
						{
							if (tmpStrictureModel.hasOwnProperty('Tables') && (typeof (tmpStrictureModel.Tables) === 'object'))
							{
								let tmpTableList = Object.keys(tmpStrictureModel.Tables);
								for (let i = 0; i < tmpTableList.length; i++)
								{
									let tmpTableName = tmpTableList[i];
									let tmpTableObject = tmpStrictureModel.Tables[tmpTableName];
									let tmpJSONSchemaInsert;
									try
									{
										tmpJSONSchemaInsert = JSON.parse(JSON.stringify(tmpTableObject));
									}
									catch (pError)
									{
										tmpSelf.log.info(`Error parsing JSON for table: ${tmpTableName} -- ${pError}`);
									}
									// Remove JsonSchema from the insert to avoid circular nesting
									delete tmpJSONSchemaInsert.JsonSchema;
									tmpTableObject.MeadowSchema.JsonSchema.MeadowSchema = tmpJSONSchemaInsert;
								}
							}
						}

						try
						{
							libFS.writeFileSync(tmpStrictureModelExtendedFile, JSON.stringify(tmpStrictureModel, null, 4));
							tmpSelf.log.info('  > Extended Model JSON Successfully Written');
							return fStageComplete();
						}
						catch (pError)
						{
							tmpSelf.log.error(`  > Error writing out Extended model JSON: ${pError}`);
							return fStageComplete(pError);
						}
					});

				// Stage 4: Write the PICT model JSON
				tmpAnticipate.anticipate(
					(fStageComplete) =>
					{
						tmpSelf.log.info('  > Compiling the PICT Definition');
						try
						{
							libFS.writeFileSync(tmpStrictureModelPICTFile, JSON.stringify(tmpStrictureModel.Pict, null, 4));
							tmpSelf.log.info('  > PICT JSON Successfully Written');
							return fStageComplete();
						}
						catch (pError)
						{
							tmpSelf.log.error(`  > Error writing out PICT model JSON: ${pError}`);
							return fStageComplete(pError);
						}
					});

				// Wait for all stages to complete
				tmpAnticipate.wait(
					(pError) =>
					{
						if (pError)
						{
							tmpSelf.log.error(`  > ERROR Compiling DDL: ${pError}`);
						}
						else
						{
							tmpSelf.log.info('  > DDL Compile Stages completed successfully.');
						}

						// Store the compiled model on AppData for use by generators
						tmpSelf.fable.AppData.Stricture = tmpStrictureModel;

						return tmpCallback(pError);
					});
			}
		);
	}
}

module.exports = StrictureServiceCompiler;

/** @type {Record<string, any>} */
StrictureServiceCompiler.default_configuration = {};
