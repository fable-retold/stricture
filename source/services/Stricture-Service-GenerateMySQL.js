/**
 * Stricture - Generator Service - MySQL CREATE Statements
 *
 * Generates MySQL CREATE TABLE statements from a compiled Stricture model.
 * Maps each column DataType to the corresponding MySQL column definition.
 *
 * Replaces the legacy Stricture-Generate-MySQL.js functionality.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libFS = require('fs');

const libFableServiceBase = require('fable').ServiceProviderBase;
const libIntegerTypes = require('../Stricture-IntegerTypes.js');

/**
 * Service that generates MySQL CREATE TABLE statements from the loaded model.
 */
class StrictureServiceGenerateMySQL extends libFableServiceBase
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

		this.serviceType = 'StrictureGenerateMySQL';
	}

	/**
	 * Generate MySQL CREATE TABLE statements from the model.
	 *
	 * Writes a single .mysql.sql file containing CREATE TABLE IF NOT EXISTS
	 * statements for every table in the model, with proper column type mapping.
	 *
	 * @param {Object} pOptions - Generation options
	 * @param {string} pOptions.OutputLocation - Directory for the output file
	 * @param {string} pOptions.OutputFileName - Base name for the output file
	 * @param {function} fCallback - Callback invoked as fCallback(pError) on completion
	 */
	generate(pOptions, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback : () => {};
		let tmpModel = this.fable.AppData.Model;

		if (!tmpModel || !tmpModel.Tables)
		{
			this.log.error('  > No model loaded; cannot generate MySQL.');
			return tmpCallback(new Error('No model loaded'));
		}

		let tmpMySQLFile = pOptions.OutputLocation + pOptions.OutputFileName + '.mysql.sql';

		this.log.info('--> Building the table create file...');

		// Write the header with generation timestamp
		libFS.writeFileSync(tmpMySQLFile, '-- Data Model -- Generated ' + new Date().toJSON() + '\n');
		libFS.appendFileSync(tmpMySQLFile, '\n');

		// Write the table-of-contents comment block
		libFS.appendFileSync(tmpMySQLFile, '-- This script creates the following tables:\n');
		libFS.appendFileSync(tmpMySQLFile, '-- Table ----------------------------------------- Column Count ----------------\n');

		for (let tmpTable in tmpModel.Tables)
		{
			let tmpTableRightPad = '                                                  ';
			let tmpTableName = tmpModel.Tables[tmpTable].TableName + tmpTableRightPad.slice(-(tmpTableRightPad.length - tmpModel.Tables[tmpTable].TableName.length));
			libFS.appendFileSync(tmpMySQLFile, '--   ' + tmpTableName + ' ' + ('      ' + tmpModel.Tables[tmpTable].Columns.length).slice(-6) + '\n');
		}

		// Write the CREATE TABLE statements
		for (let tmpTable in tmpModel.Tables)
		{
			this.log.info('  > ' + tmpModel.Tables[tmpTable].TableName);

			let tmpPrimaryKey = false;

			libFS.appendFileSync(tmpMySQLFile, '\n\n\n' + '--   [ ' + tmpModel.Tables[tmpTable].TableName + ' ]');
			libFS.appendFileSync(tmpMySQLFile, '\nCREATE TABLE IF NOT EXISTS\n    ' + tmpModel.Tables[tmpTable].TableName + '\n    (');

			for (let j = 0; j < tmpModel.Tables[tmpTable].Columns.length; j++)
			{
				// Comma before every column except the first
				if (j > 0)
				{
					libFS.appendFileSync(tmpMySQLFile, ',');
				}

				libFS.appendFileSync(tmpMySQLFile, '\n');

				let tmpColumn = tmpModel.Tables[tmpTable].Columns[j];

				// Map each DataType to MySQL column definition
				switch (tmpColumn.DataType)
				{
					case 'ID':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' ' + libIntegerTypes.getMySQLIntegerType(libIntegerTypes.getIntegerType(tmpColumn)) + ' NOT NULL AUTO_INCREMENT');
						tmpPrimaryKey = tmpColumn.Column;
						break;
					case 'GUID':
						// Default GUID column width is 255 — see notes in
						// Stricture-Generate-MySQL.js. UUIDs are 36 but
						// composite GUIDs from integration adapters often
						// exceed that.
						let tmpSize = tmpColumn.hasOwnProperty('Size') ? tmpColumn.Size : 255;
						if (isNaN(tmpSize))
						{
							tmpSize = 255;
						}
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' CHAR(' + tmpSize + ") NOT NULL DEFAULT '0xDe'");
						break;
					case 'ForeignKey':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' ' + libIntegerTypes.getMySQLIntegerType(libIntegerTypes.getIntegerType(tmpColumn)) + " NOT NULL DEFAULT '0'");
						tmpPrimaryKey = tmpColumn.Column;
						break;
					case 'Numeric':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' ' + libIntegerTypes.getMySQLIntegerType(libIntegerTypes.getIntegerType(tmpColumn)) + " NOT NULL DEFAULT '0'");
						break;
					case 'Decimal':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' DECIMAL(' + tmpColumn.Size + ')');
						break;
					case 'String':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' CHAR(' + tmpColumn.Size + ") NOT NULL DEFAULT ''");
						break;
					case 'Text':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' TEXT');
						break;
					case 'DateTime':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' DATETIME');
						break;
					case 'Boolean':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + " TINYINT NOT NULL DEFAULT '0'");
						break;
					case 'JSON':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.Column + ' LONGTEXT');
						break;
					case 'JSONProxy':
						libFS.appendFileSync(tmpMySQLFile, '        ' + tmpColumn.StorageColumn + ' LONGTEXT');
						break;
					default:
						break;
				}
			}

			// Add the primary key constraint
			if (tmpPrimaryKey)
			{
				libFS.appendFileSync(tmpMySQLFile, ',\n\n        PRIMARY KEY (' + tmpPrimaryKey + ')');
			}
			libFS.appendFileSync(tmpMySQLFile, '\n    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n');
		}

		return tmpCallback(null);
	}
}

module.exports = StrictureServiceGenerateMySQL;

/** @type {Record<string, any>} */
StrictureServiceGenerateMySQL.default_configuration = {};
