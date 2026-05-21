/**
 * Stricture - Generator Service - Meadow Schema Files
 *
 * Generates individual Meadow schema JSON files for each table in the model.
 * Each file contains the Scope, DefaultIdentifier, Schema, DefaultObject,
 * JsonSchema, and Authorization data needed by the Meadow ORM.
 *
 * Replaces the legacy Stricture-Generate-Meadow.js functionality.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libFS = require('fs');

const libFableServiceBase = require('fable').ServiceProviderBase;

/**
 * Service that generates per-table Meadow schema JSON files.
 */
class StrictureServiceGenerateMeadow extends libFableServiceBase
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

		this.serviceType = 'StrictureGenerateMeadow';
	}

	/**
	 * Generate Meadow schema files for each table in the model.
	 *
	 * For each table, builds a Meadow-compatible schema definition including
	 * column types, default values, JSON schema, and authorization settings,
	 * then writes it as a JSON file.
	 *
	 * @param {Object} pOptions - Generation options
	 * @param {string} pOptions.OutputLocation - Directory for the output files
	 * @param {string} pOptions.OutputFileName - Base prefix for output files
	 * @param {function} fCallback - Callback invoked as fCallback(pError) on completion
	 */
	generate(pOptions, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};
		let tmpModel = this.fable.AppData.Model;

		if (!tmpModel || !tmpModel.Tables)
		{
			this.log.error('  > No model loaded; cannot generate Meadow schemas.');
			return tmpCallback(new Error('No model loaded'));
		}

		let tmpMeadowFileLocation = pOptions.OutputLocation + pOptions.OutputFileName;

		this.log.info('--> Building the Meadow model description files...');

		let tmpTableKeys = Object.keys(tmpModel.Tables);
		let tmpIndex = 0;
		let tmpSelf = this;

		// Process tables sequentially to avoid overwhelming file I/O
		let processNextTable = () =>
		{
			if (tmpIndex >= tmpTableKeys.length)
			{
				return tmpCallback(null);
			}

			let tmpTableKey = tmpTableKeys[tmpIndex];
			tmpIndex++;

			let tmpTable = tmpModel.Tables[tmpTableKey];
			tmpSelf.log.info('  > Table: ' + tmpTable.TableName);

			let tmpPrimaryKey = 'ID' + tmpTable.TableName;

			// Find the primary key column
			for (let j = 0; j < tmpTable.Columns.length; j++)
			{
				if (tmpTable.Columns[j].DataType === 'ID')
				{
					tmpPrimaryKey = tmpTable.Columns[j].Column;
				}
			}

			let tmpMeadowModel = {
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

			// Build the schema for each column
			for (let j = 0; j < tmpTable.Columns.length; j++)
			{
				let tmpColumnName = tmpTable.Columns[j].Column;
				let tmpColumnType = tmpTable.Columns[j].DataType;
				let tmpColumnSize = tmpTable.Columns[j].hasOwnProperty('Size') ? tmpTable.Columns[j].Size : 'Default';

				let tmpSchemaEntry = { Column: tmpColumnName, Type: 'Default' };

				switch (tmpColumnType)
				{
					case 'ID':
						tmpSchemaEntry.Type = 'AutoIdentity';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
						tmpMeadowModel.JsonSchema.required.push(tmpColumnName);
						break;
					case 'GUID':
						tmpSchemaEntry.Type = 'AutoGUID';
						tmpMeadowModel.DefaultObject[tmpColumnName] = '0x0000000000000000';
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
						break;
					case 'ForeignKey':
						tmpSchemaEntry.Type = 'Integer';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
						tmpMeadowModel.JsonSchema.required.push(tmpColumnName);
						break;
					case 'Numeric':
						tmpSchemaEntry.Type = 'Integer';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'integer', size: tmpColumnSize };
						break;
					case 'Decimal':
						tmpSchemaEntry.Type = 'Decimal';
						tmpMeadowModel.DefaultObject[tmpColumnName] = 0.0;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'number', size: tmpColumnSize };
						break;
					case 'String':
					case 'Text':
						tmpSchemaEntry.Type = 'String';
						tmpMeadowModel.DefaultObject[tmpColumnName] = '';
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
						break;
					case 'DateTime':
						tmpSchemaEntry.Type = 'DateTime';
						tmpMeadowModel.DefaultObject[tmpColumnName] = null;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'string', size: tmpColumnSize };
						break;
					case 'Boolean':
						tmpSchemaEntry.Type = 'Boolean';
						tmpMeadowModel.DefaultObject[tmpColumnName] = false;
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'boolean', size: tmpColumnSize };
						break;
					case 'JSON':
						tmpSchemaEntry.Type = 'JSON';
						tmpMeadowModel.DefaultObject[tmpColumnName] = {};
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'object' };
						break;
					case 'JSONProxy':
						tmpSchemaEntry.Type = 'JSONProxy';
						tmpSchemaEntry.StorageColumn = tmpTable.Columns[j].StorageColumn;
						tmpMeadowModel.DefaultObject[tmpColumnName] = {};
						tmpMeadowModel.JsonSchema.properties[tmpColumnName] = { type: 'object' };
						break;
				}

				// Mark magic change-tracking columns
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
				tmpMeadowModel.Schema.push(tmpSchemaEntry);
			}

			// Add authorization if present in the model
			if (tmpModel.hasOwnProperty('Authorization') && tmpModel.Authorization.hasOwnProperty(tmpTable.TableName))
			{
				tmpMeadowModel.Authorization = tmpModel.Authorization[tmpTable.TableName];
			}

			// Carry named indices through to the Meadow schema so connectors / migration manager pick them up
			if (Array.isArray(tmpTable.Indices) && tmpTable.Indices.length > 0)
			{
				tmpMeadowModel.Indices = JSON.parse(JSON.stringify(tmpTable.Indices));
			}

			// Embed the Meadow schema within the JsonSchema for cross-referencing
			let tmpJSONSchemaInsert = JSON.parse(JSON.stringify(tmpMeadowModel));
			delete tmpJSONSchemaInsert.JsonSchema;
			tmpMeadowModel.JsonSchema.MeadowSchema = tmpJSONSchemaInsert;

			// Write the per-table schema file
			libFS.writeFile(tmpMeadowFileLocation + tmpMeadowModel.Scope + '.json', JSON.stringify(tmpMeadowModel, null, 4), 'utf8',
				(pError) =>
				{
					if (pError)
					{
						tmpSelf.log.error('#### ERROR PERSISTING SCHEMA: ' + pError);
					}
					processNextTable();
				});
		};

		processNextTable();
	}
}

module.exports = StrictureServiceGenerateMeadow;

/** @type {Record<string, any>} */
StrictureServiceGenerateMeadow.default_configuration = {};
