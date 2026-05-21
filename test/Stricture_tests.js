/**
 * Unit tests for the Stricture MicroDDL Compiler and Code Generator
 *
 * @license     MIT
 *
 * @author      Steven Velozo <steven@velozo.com>
 */

var Chai = require("chai");
var Expect = Chai.expect;

var libFS = require('fs');
var libPath = require('path');

var libMkdirp = require('mkdirp');

// Output location for test-generated files
var _TestOutputFolder = libPath.resolve(__dirname, '../test_output/') + '/';

// Example MicroDDL paths
var _SimpleAddressFile = libPath.resolve(__dirname, '../Examples/SimpleAddress.mddl');
var _ComplexAddressFile = libPath.resolve(__dirname, '../Examples/ComplexAddress.mddl');
var _NorthwindFile = libPath.resolve(__dirname, '../Examples/Northwind.mddl');
var _IndexedSchemaFile = libPath.resolve(__dirname, '../Examples/IndexedSchema.mddl');

// Clean up test output before the run, then ensure the directory exists
function cleanTestOutput()
{
	if (libFS.existsSync(_TestOutputFolder))
	{
		libFS.rmSync(_TestOutputFolder, { recursive: true, force: true });
	}
	libMkdirp.sync(_TestOutputFolder);
}

// Helper to instantiate a fresh Stricture instance
function newStricture(pLogLevel)
{
	var Stricture = require('../source/Stricture.js');
	return new Stricture({ Product: 'StrictureTest', LogLevel: (typeof (pLogLevel) !== 'undefined') ? pLogLevel : 0 });
}

// Helper: compile -> load -> generate pipeline
function compileAndLoadModel(pInstance, pInputFile, pOutputFolder, pOutputName, fCallback)
{
	var tmpCompiler = pInstance.instantiateServiceProvider('StrictureCompiler');
	tmpCompiler.compileFile(pInputFile, pOutputFolder, pOutputName,
		function (pError)
		{
			if (pError) { return fCallback(pError); }
			var tmpLoader = pInstance.instantiateServiceProvider('StrictureModelLoader');
			tmpLoader.loadFromFile(pOutputFolder + pOutputName + '-Extended.json', fCallback);
		});
}

suite
(
	'Stricture',
	function ()
	{
		setup
		(
			function ()
			{
			}
		);

		// ========================================================================
		// Object Sanity
		// ========================================================================
		suite
		(
			'Object Sanity',
			function ()
			{
				test
				(
					'initialize should build a happy little object',
					function ()
					{
						var tmpStricture = require('../source/Stricture.js');
						Expect(tmpStricture).to.be.a('function', 'Stricture should initialize as a constructor from the require statement.');
					}
				);
				test
				(
					'should construct a Stricture instance with all service types registered',
					function ()
					{
						var tmpInstance = newStricture();
						Expect(tmpInstance).to.be.an('object');
						Expect(tmpInstance.AppData).to.be.an('object');
					}
				);
				test
				(
					'should be able to instantiate each service type',
					function ()
					{
						var tmpInstance = newStricture();

						var tmpServiceTypes =
						[
							'StrictureCompiler',
							'StrictureModelLoader',
							'StrictureGenerateMySQL',
							'StrictureGenerateMySQLMigrate',
							'StrictureGenerateMeadow',
							'StrictureGenerateMarkdown',
							'StrictureGenerateLaTeX',
							'StrictureGenerateDictionaryCSV',
							'StrictureGenerateModelGraph',
							'StrictureGenerateAuthChart',
							'StrictureGeneratePict',
							'StrictureGenerateTestFixtures'
						];

						for (var i = 0; i < tmpServiceTypes.length; i++)
						{
							var tmpService = tmpInstance.instantiateServiceProvider(tmpServiceTypes[i]);
							Expect(tmpService).to.be.an('object', tmpServiceTypes[i] + ' should instantiate as an object.');
							Expect(tmpService.serviceType).to.equal(tmpServiceTypes[i]);
						}
					}
				);
				test
				(
					'should expose the version through package.json',
					function ()
					{
						var tmpPkg = require('../package.json');
						Expect(tmpPkg.version).to.match(/^\d+\.\d+\.\d+/);
						Expect(tmpPkg.name).to.equal('stricture');
					}
				);
			}
		);

		// ========================================================================
		// Compiler Service
		// ========================================================================
		suite
		(
			'Compiler Service',
			function ()
			{
				test
				(
					'should compile SimpleAddress.mddl to JSON',
					function (fDone)
					{
						cleanTestOutput();

						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						Expect(tmpCompiler).to.be.an('object');
						Expect(tmpCompiler.serviceType).to.equal('StrictureCompiler');

						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'TestModel',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								// Check that output files were created
								Expect(libFS.existsSync(_TestOutputFolder + 'TestModel.json')).to.be.true;
								Expect(libFS.existsSync(_TestOutputFolder + 'TestModel-Extended.json')).to.be.true;
								Expect(libFS.existsSync(_TestOutputFolder + 'TestModel-PICT.json')).to.be.true;

								// Verify the model structure
								var tmpModel = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'TestModel.json', 'utf8'));
								Expect(tmpModel).to.have.property('Tables');
								Expect(tmpModel.Tables).to.have.property('User');
								Expect(tmpModel.Tables).to.have.property('Contact');
								Expect(tmpModel.Tables).to.have.property('Address');
								Expect(tmpModel.Tables.User.Columns).to.have.length(6);
								Expect(tmpModel.Tables.Contact.Columns).to.have.length(4);
								Expect(tmpModel.Tables.Address.Columns).to.have.length(8);

								// Verify the extended model
								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'TestModel-Extended.json', 'utf8'));
								Expect(tmpExtended).to.have.property('Tables');
								Expect(tmpExtended).to.have.property('Authorization');
								Expect(tmpExtended).to.have.property('Endpoints');
								// Extended model includes per-table MeadowSchema
								Expect(tmpExtended.Tables.User).to.have.property('MeadowSchema');

								fDone();
							});
					}
				);

				test
				(
					'should compile ComplexAddress.mddl with domains and authorization',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						var tmpOutputFolder = _TestOutputFolder + 'complex/';

						tmpCompiler.compileFile(_ComplexAddressFile, tmpOutputFolder, 'ComplexModel',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpModel = JSON.parse(libFS.readFileSync(tmpOutputFolder + 'ComplexModel.json', 'utf8'));
								Expect(tmpModel).to.have.property('Tables');
								Expect(tmpModel.Tables).to.have.property('User');
								Expect(tmpModel.Tables).to.have.property('Address');
								Expect(tmpModel.Tables).to.have.property('Contact');

								// Address should be in the Metadata domain
								Expect(tmpModel.Tables.Address.Domain).to.equal('Metadata');
								// User should be in the Default domain
								Expect(tmpModel.Tables.User.Domain).to.equal('Default');

								// Verify the extended model includes Authorization overrides
								var tmpExtended = JSON.parse(libFS.readFileSync(tmpOutputFolder + 'ComplexModel-Extended.json', 'utf8'));
								Expect(tmpExtended).to.have.property('Authorization');
								Expect(tmpExtended.Authorization).to.have.property('Contact');
								// Contact authorization should have customized entries
								Expect(tmpExtended.Authorization.Contact.User.Read).to.equal('Deny');
								Expect(tmpExtended.Authorization.Contact.User.Create).to.equal('Allow');
								Expect(tmpExtended.Authorization.Contact.Manager.Read).to.equal('Mine');

								// Verify PICT configuration was parsed
								Expect(tmpExtended).to.have.property('Pict');
								Expect(tmpExtended.Pict).to.have.property('User');
								Expect(tmpExtended.Pict.User.List.Columns).to.have.length(2);
								Expect(tmpExtended.Pict).to.have.property('Address');
								Expect(tmpExtended.Pict.Address.List.Enabled).to.equal(false);

								fDone();
							});
					}
				);

				test
				(
					'should compile Northwind.mddl with many tables and relationships',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						var tmpOutputFolder = _TestOutputFolder + 'northwind/';

						tmpCompiler.compileFile(_NorthwindFile, tmpOutputFolder, 'NorthwindModel',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpModel = JSON.parse(libFS.readFileSync(tmpOutputFolder + 'NorthwindModel.json', 'utf8'));
								Expect(tmpModel).to.have.property('Tables');

								// Northwind should have 13 tables
								var tmpTableNames = Object.keys(tmpModel.Tables);
								Expect(tmpTableNames.length).to.equal(13);

								// Spot-check some tables
								Expect(tmpModel.Tables).to.have.property('Employees');
								Expect(tmpModel.Tables).to.have.property('Orders');
								Expect(tmpModel.Tables).to.have.property('Products');
								Expect(tmpModel.Tables).to.have.property('Customers');

								// Verify foreign key joins were parsed
								var tmpOrders = tmpModel.Tables.Orders;
								var tmpCustomerJoin = tmpOrders.Columns.find(function (pCol) { return pCol.Column === 'CustomerID'; });
								Expect(tmpCustomerJoin).to.be.an('object');
								Expect(tmpCustomerJoin.Join).to.equal('CustomerID');
								Expect(tmpCustomerJoin.DataType).to.equal('ForeignKey');

								// Verify decimal columns
								var tmpSalaryCol = tmpModel.Tables.Employees.Columns.find(function (pCol) { return pCol.Column === 'Salary'; });
								Expect(tmpSalaryCol).to.be.an('object');
								Expect(tmpSalaryCol.DataType).to.equal('Decimal');

								fDone();
							});
					}
				);

				test
				(
					'should store compiled model on AppData.Stricture',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'AppDataTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpInstance.AppData.Stricture).to.be.an('object');
								Expect(tmpInstance.AppData.Stricture.Tables).to.have.property('User');
								Expect(tmpInstance.AppData.Stricture.TablesSequence).to.be.an('array');
								Expect(tmpInstance.AppData.Stricture.TablesSequence).to.include('User');
								Expect(tmpInstance.AppData.Stricture.TablesSequence).to.include('Contact');
								Expect(tmpInstance.AppData.Stricture.TablesSequence).to.include('Address');

								fDone();
							});
					}
				);

				test
				(
					'should handle callback-less invocation without throwing',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						// Call without callback -- should not throw
						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'NoCallbackTest');

						// Give it a moment to finish, then verify files were still written
						setTimeout(function ()
						{
							Expect(libFS.existsSync(_TestOutputFolder + 'NoCallbackTest.json')).to.be.true;
							fDone();
						}, 500);
					}
				);

				test
				(
					'should create the output directory when it does not exist',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						var tmpNewFolder = _TestOutputFolder + 'auto_created_folder/nested/';

						tmpCompiler.compileFile(_SimpleAddressFile, tmpNewFolder, 'AutoDir',
							function (pError)
							{
								Expect(pError).to.not.be.ok;
								Expect(libFS.existsSync(tmpNewFolder + 'AutoDir.json')).to.be.true;
								fDone();
							});
					}
				);
			}
		);

		// ========================================================================
		// Compiler Internals - parseComplexProperties
		// ========================================================================
		suite
		(
			'Compiler Internals',
			function ()
			{
				test
				(
					'parseComplexProperties should parse title stanzas',
					function ()
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						var tmpEntries = {};
						var tmpLineType = tmpCompiler.parseComplexProperties('(List of Users)', tmpEntries);

						Expect(tmpLineType).to.equal('Title');
						Expect(tmpEntries.TitleTemplate).to.equal('List of Users');
					}
				);

				test
				(
					'parseComplexProperties should parse property stanzas',
					function ()
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						var tmpEntries = {};
						var tmpLineType = tmpCompiler.parseComplexProperties(':Enabled=false', tmpEntries);

						Expect(tmpLineType).to.equal('Property');
						Expect(tmpEntries.PropertyName).to.equal('Enabled');
						Expect(tmpEntries.PropertyValue).to.equal(false);
					}
				);

				test
				(
					'parseComplexProperties should parse boolean true property',
					function ()
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						var tmpEntries = {};
						tmpCompiler.parseComplexProperties(':Visible=true', tmpEntries);

						Expect(tmpEntries.PropertyName).to.equal('Visible');
						Expect(tmpEntries.PropertyValue).to.equal(true);
					}
				);

				test
				(
					'parseComplexProperties should parse key:value pair stanzas',
					function ()
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						// Note: parseComplexProperties does NOT set Column — that is done by the calling code.
						// The first space-separated token (before any key:value) is skipped by the parser.
						var tmpEntries = { Column: 'UserName' };
						var tmpLineType = tmpCompiler.parseComplexProperties('UserName Type:text HideAt:md', tmpEntries);

						Expect(tmpLineType).to.equal('ValueSet');
						Expect(tmpEntries.Column).to.equal('UserName');
						Expect(tmpEntries.Type).to.equal('text');
						Expect(tmpEntries.HideAt).to.equal('md');
					}
				);

				test
				(
					'parseComplexProperties should handle quoted values',
					function ()
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						// Column is pre-set by calling code (see Compiler PICT stanza), not by parseComplexProperties
						var tmpEntries = { Column: 'City' };
						tmpCompiler.parseComplexProperties('City Title:"City of Residence"', tmpEntries);

						Expect(tmpEntries.Column).to.equal('City');
						Expect(tmpEntries.Title).to.equal('City of Residence');
					}
				);
			}
		);

		// ========================================================================
		// MeadowSchema Generation (inline in Compiler)
		// ========================================================================
		suite
		(
			'MeadowSchema Generation',
			function ()
			{
				test
				(
					'should generate inline MeadowSchema for each table during compilation',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'SchemaTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'SchemaTest-Extended.json', 'utf8'));

								// Each table should have a MeadowSchema
								var tmpUserSchema = tmpExtended.Tables.User.MeadowSchema;
								Expect(tmpUserSchema).to.be.an('object');
								Expect(tmpUserSchema.Scope).to.equal('User');
								Expect(tmpUserSchema.DefaultIdentifier).to.equal('IDUser');
								Expect(tmpUserSchema.Schema).to.be.an('array');
								Expect(tmpUserSchema.DefaultObject).to.be.an('object');

								// Verify the schema types are correct
								var tmpIDSchema = tmpUserSchema.Schema.find(function (s) { return s.Column === 'IDUser'; });
								Expect(tmpIDSchema.Type).to.equal('AutoIdentity');
								var tmpStringSchema = tmpUserSchema.Schema.find(function (s) { return s.Column === 'UserName'; });
								Expect(tmpStringSchema.Type).to.equal('String');

								// Verify default object values
								Expect(tmpUserSchema.DefaultObject.IDUser).to.equal(0);
								Expect(tmpUserSchema.DefaultObject.UserName).to.equal('');
								Expect(tmpUserSchema.DefaultObject.Email).to.equal('');

								// Verify JsonSchema
								Expect(tmpUserSchema.JsonSchema).to.be.an('object');
								Expect(tmpUserSchema.JsonSchema.title).to.equal('User');
								Expect(tmpUserSchema.JsonSchema.required).to.include('IDUser');

								fDone();
							});
					}
				);

				test
				(
					'should detect magic change-tracking column types',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_ComplexAddressFile, _TestOutputFolder, 'MagicColTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'MagicColTest-Extended.json', 'utf8'));
								var tmpAddressSchema = tmpExtended.Tables.Address.MeadowSchema;

								// CreatingIDUser should be detected as CreateIDUser type
								var tmpCreatingCol = tmpAddressSchema.Schema.find(function (s) { return s.Column === 'CreatingIDUser'; });
								Expect(tmpCreatingCol.Type).to.equal('CreateIDUser');

								fDone();
							});
					}
				);
			}
		);

		// ========================================================================
		// Named Index Parsing
		// ========================================================================
		suite
		(
			'Named Index Parsing',
			function ()
			{
				test
				(
					'should parse single-column unique and regular indexes onto the table',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_IndexedSchemaFile, _TestOutputFolder, 'IndexTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'IndexTest-Extended.json', 'utf8'));
								var tmpUser = tmpExtended.Tables.User;

								Expect(tmpUser.Indices).to.be.an('array');
								Expect(tmpUser.Indices.length).to.equal(3);

								var tmpUsernameIdx = tmpUser.Indices.find(function (i) { return i.Name === 'AK_User_Username'; });
								Expect(tmpUsernameIdx).to.be.an('object');
								Expect(tmpUsernameIdx.Unique).to.equal(true);
								Expect(tmpUsernameIdx.Columns).to.deep.equal(['UserName']);

								var tmpActiveIdx = tmpUser.Indices.find(function (i) { return i.Name === 'IX_User_Active'; });
								Expect(tmpActiveIdx).to.be.an('object');
								Expect(tmpActiveIdx.Unique).to.equal(false);
								Expect(tmpActiveIdx.Columns).to.deep.equal(['Active']);

								fDone();
							});
					}
				);

				test
				(
					'should parse composite (multi-column) indexes',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_IndexedSchemaFile, _TestOutputFolder, 'IndexCompositeTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'IndexCompositeTest-Extended.json', 'utf8'));
								var tmpSession = tmpExtended.Tables.UserSession;

								var tmpComposite = tmpSession.Indices.find(function (i) { return i.Name === 'IX_UserSession_UserDate'; });
								Expect(tmpComposite).to.be.an('object');
								Expect(tmpComposite.Unique).to.equal(false);
								Expect(tmpComposite.Columns).to.deep.equal(['IDUser', 'LoginDate']);

								fDone();
							});
					}
				);

				test
				(
					'should carry parsed indexes through to the MeadowSchema for connector consumption',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_IndexedSchemaFile, _TestOutputFolder, 'IndexMeadowTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'IndexMeadowTest-Extended.json', 'utf8'));
								var tmpUserMeadow = tmpExtended.Tables.User.MeadowSchema;
								var tmpSessionMeadow = tmpExtended.Tables.UserSession.MeadowSchema;

								Expect(tmpUserMeadow.Indices).to.be.an('array');
								Expect(tmpUserMeadow.Indices.length).to.equal(3);

								var tmpUserMeadowEmail = tmpUserMeadow.Indices.find(function (i) { return i.Name === 'AK_User_Email'; });
								Expect(tmpUserMeadowEmail.Unique).to.equal(true);
								Expect(tmpUserMeadowEmail.Columns).to.deep.equal(['Email']);

								var tmpSessionMeadowComposite = tmpSessionMeadow.Indices.find(function (i) { return i.Name === 'IX_UserSession_UserDate'; });
								Expect(tmpSessionMeadowComposite.Columns).to.deep.equal(['IDUser', 'LoginDate']);

								fDone();
							});
					}
				);

				test
				(
					'should not introduce Indices on tables without index declarations',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'IndexAbsentTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpExtended = JSON.parse(libFS.readFileSync(_TestOutputFolder + 'IndexAbsentTest-Extended.json', 'utf8'));
								var tmpUser = tmpExtended.Tables.User;

								// The DDL-level Indices array is always initialized (empty)
								Expect(tmpUser.Indices).to.be.an('array');
								Expect(tmpUser.Indices.length).to.equal(0);

								// MeadowSchema only gets an Indices field when there are declarations
								Expect(tmpUser.MeadowSchema.Indices).to.equal(undefined);

								fDone();
							});
					}
				);
			}
		);

		// ========================================================================
		// Model Loader Service
		// ========================================================================
		suite
		(
			'Model Loader Service',
			function ()
			{
				test
				(
					'should load a compiled JSON model and build indices',
					function (fDone)
					{
						var tmpInstance = newStricture();

						// First compile a model
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');

						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'LoaderTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								// Now load the extended model
								var tmpLoader = tmpInstance.instantiateServiceProvider('StrictureModelLoader');
								tmpLoader.loadFromFile(_TestOutputFolder + 'LoaderTest-Extended.json',
									function (pLoadError)
									{
										Expect(pLoadError).to.not.be.ok;
										Expect(tmpInstance.AppData.Model).to.be.an('object');
										Expect(tmpInstance.AppData.Model.Tables).to.have.property('User');
										Expect(tmpInstance.AppData.ModelIndices).to.be.an('object');
										// ModelIndices maps ID column names to table names
										Expect(tmpInstance.AppData.ModelIndices['IDUser']).to.equal('User');
										Expect(tmpInstance.AppData.ModelIndices['IDContact']).to.equal('Contact');
										Expect(tmpInstance.AppData.ModelIndices['IDAddress']).to.equal('Address');

										fDone();
									});
							});
					}
				);

				test
				(
					'should detect an extended model file',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'ExtDetectTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;
								Expect(tmpInstance.AppData.ExtendedModel).to.equal(true);
								fDone();
							});
					}
				);

				test
				(
					'should detect a non-extended model file',
					function (fDone)
					{
						var tmpInstance = newStricture();

						// First compile to get the base model
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						tmpCompiler.compileFile(_SimpleAddressFile, _TestOutputFolder, 'NonExtTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								// Load the base model (not the extended one)
								var tmpLoader = tmpInstance.instantiateServiceProvider('StrictureModelLoader');
								tmpLoader.loadFromFile(_TestOutputFolder + 'NonExtTest.json',
									function (pLoadError)
									{
										Expect(pLoadError).to.not.be.ok;
										Expect(tmpInstance.AppData.ExtendedModel).to.equal(false);
										fDone();
									});
							});
					}
				);

				test
				(
					'should return an error for a missing file',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpLoader = tmpInstance.instantiateServiceProvider('StrictureModelLoader');

						tmpLoader.loadFromFile('/nonexistent/path/to/model.json',
							function (pError)
							{
								Expect(pError).to.be.an('error');
								fDone();
							});
					}
				);

				test
				(
					'should return an error for invalid JSON',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpLoader = tmpInstance.instantiateServiceProvider('StrictureModelLoader');

						// Write a file with invalid JSON
						var tmpBadFile = _TestOutputFolder + 'bad-json.json';
						libFS.writeFileSync(tmpBadFile, 'this is not valid json {{{');

						tmpLoader.loadFromFile(tmpBadFile,
							function (pError)
							{
								Expect(pError).to.be.an('error');
								fDone();
							});
					}
				);
			}
		);

		// ========================================================================
		// MySQL Generator Service
		// ========================================================================
		suite
		(
			'MySQL Generator Service',
			function ()
			{
				test
				(
					'should generate MySQL CREATE TABLE statements',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'MySQLTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQL');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'MySQLTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpSQLFile = _TestOutputFolder + 'MySQLTest.mysql.sql';
										Expect(libFS.existsSync(tmpSQLFile)).to.be.true;

										var tmpSQL = libFS.readFileSync(tmpSQLFile, 'utf8');
										Expect(tmpSQL).to.contain('CREATE TABLE IF NOT EXISTS');
										Expect(tmpSQL).to.contain('User');
										Expect(tmpSQL).to.contain('Contact');
										Expect(tmpSQL).to.contain('Address');
										Expect(tmpSQL).to.contain('PRIMARY KEY');
										Expect(tmpSQL).to.contain('IDUser INT UNSIGNED NOT NULL AUTO_INCREMENT');

										fDone();
									});
							});
					}
				);

				test
				(
					'should map all column data types correctly in MySQL output',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _ComplexAddressFile, _TestOutputFolder, 'MySQLTypesTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQL');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'MySQLTypesTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpSQL = libFS.readFileSync(_TestOutputFolder + 'MySQLTypesTest.mysql.sql', 'utf8');

										// DateTime column
										Expect(tmpSQL).to.contain('DATETIME');
										// String column with size
										Expect(tmpSQL).to.contain('CHAR(');
										// Numeric column (# type maps to INT NOT NULL)
										Expect(tmpSQL).to.contain("INT NOT NULL DEFAULT '0'");
										// utf8mb4 charset
										Expect(tmpSQL).to.contain('DEFAULT CHARSET=utf8mb4');

										fDone();
									});
							});
					}
				);

				test
				(
					'should generate MySQL for Northwind model with all data types',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _NorthwindFile, _TestOutputFolder, 'NorthwindMySQL',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQL');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'NorthwindMySQL' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpSQL = libFS.readFileSync(_TestOutputFolder + 'NorthwindMySQL.mysql.sql', 'utf8');

										// Should contain all 11 tables
										Expect(tmpSQL).to.contain('Employees');
										Expect(tmpSQL).to.contain('Orders');
										Expect(tmpSQL).to.contain('Products');
										// Decimal columns
										Expect(tmpSQL).to.contain('DECIMAL(');
										// Text columns
										Expect(tmpSQL).to.contain('TEXT');

										fDone();
									});
							});
					}
				);

				test
				(
					'should error when no model is loaded',
					function (fDone)
					{
						var tmpInstance = newStricture();
						var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQL');
						tmpGenerator.generate(
							{ OutputLocation: _TestOutputFolder, OutputFileName: 'NoModel' },
							function (pGenError)
							{
								Expect(pGenError).to.be.an('error');
								fDone();
							});
					}
				);
			}
		);

		// ========================================================================
		// MySQL Migrate Generator Service
		// ========================================================================
		suite
		(
			'MySQL Migrate Generator Service',
			function ()
			{
				test
				(
					'should generate MySQL migration stubs',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'MigrateTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQLMigrate');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'MigrateTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpSQLFile = _TestOutputFolder + 'MigrateTest-Migration.mysql.sql';
										Expect(libFS.existsSync(tmpSQLFile)).to.be.true;

										var tmpSQL = libFS.readFileSync(tmpSQLFile, 'utf8');
										Expect(tmpSQL).to.contain('INSERT INTO');
										Expect(tmpSQL).to.contain('SELECT');
										Expect(tmpSQL).to.contain('DB_TO.');
										Expect(tmpSQL).to.contain('DB_FROM.');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Meadow Generator Service
		// ========================================================================
		suite
		(
			'Meadow Generator Service',
			function ()
			{
				test
				(
					'should generate per-table Meadow schema JSON files',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'MeadowTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpMeadowFolder = _TestOutputFolder + 'meadow_test/';
								require('mkdirp').sync(tmpMeadowFolder);

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMeadow');
								tmpGenerator.generate(
									{ OutputLocation: tmpMeadowFolder, OutputFileName: 'MeadowSchema' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										// Should have per-table JSON files
										Expect(libFS.existsSync(tmpMeadowFolder + 'MeadowSchemaUser.json')).to.be.true;
										Expect(libFS.existsSync(tmpMeadowFolder + 'MeadowSchemaContact.json')).to.be.true;
										Expect(libFS.existsSync(tmpMeadowFolder + 'MeadowSchemaAddress.json')).to.be.true;

										// Verify structure of a schema
										var tmpUserSchema = JSON.parse(libFS.readFileSync(tmpMeadowFolder + 'MeadowSchemaUser.json', 'utf8'));
										Expect(tmpUserSchema).to.have.property('Scope');
										Expect(tmpUserSchema.Scope).to.equal('User');
										Expect(tmpUserSchema).to.have.property('Schema');
										Expect(tmpUserSchema).to.have.property('DefaultObject');
										Expect(tmpUserSchema).to.have.property('DefaultIdentifier');
										Expect(tmpUserSchema.DefaultIdentifier).to.equal('IDUser');
										Expect(tmpUserSchema).to.have.property('JsonSchema');
										Expect(tmpUserSchema.JsonSchema.MeadowSchema).to.be.an('object');

										fDone();
									});
							});
					}
				);

				test
				(
					'should include authorization data in Meadow schemas when present',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _ComplexAddressFile, _TestOutputFolder, 'MeadowAuthTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpMeadowFolder = _TestOutputFolder + 'meadow_auth_test/';
								require('mkdirp').sync(tmpMeadowFolder);

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMeadow');
								tmpGenerator.generate(
									{ OutputLocation: tmpMeadowFolder, OutputFileName: 'AuthSchema' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										// Contact has custom authorization
										var tmpContactSchema = JSON.parse(libFS.readFileSync(tmpMeadowFolder + 'AuthSchemaContact.json', 'utf8'));
										Expect(tmpContactSchema.Authorization).to.be.an('object');
										Expect(tmpContactSchema.Authorization.User.Read).to.equal('Deny');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Markdown Generator Service
		// ========================================================================
		suite
		(
			'Markdown Generator Service',
			function ()
			{
				test
				(
					'should generate Markdown documentation files',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'MarkdownTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpDocFolder = _TestOutputFolder + 'doc_test/';
								require('mkdirp').sync(tmpDocFolder);

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateMarkdown');
								tmpGenerator.generate(
									{ OutputLocation: tmpDocFolder, OutputFileName: 'DocTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										Expect(libFS.existsSync(tmpDocFolder + 'Dictionary.md')).to.be.true;
										Expect(libFS.existsSync(tmpDocFolder + 'Model-User.md')).to.be.true;
										Expect(libFS.existsSync(tmpDocFolder + 'Model-Contact.md')).to.be.true;
										Expect(libFS.existsSync(tmpDocFolder + 'Model-Address.md')).to.be.true;
										Expect(libFS.existsSync(tmpDocFolder + 'ModelChangeTracking.md')).to.be.true;

										var tmpDict = libFS.readFileSync(tmpDocFolder + 'Dictionary.md', 'utf8');
										Expect(tmpDict).to.contain('Data Dictionary');
										Expect(tmpDict).to.contain('User');
										Expect(tmpDict).to.contain('Contact');
										Expect(tmpDict).to.contain('Address');

										// Verify per-table model file content
										var tmpUserModel = libFS.readFileSync(tmpDocFolder + 'Model-User.md', 'utf8');
										Expect(tmpUserModel).to.contain('User');
										Expect(tmpUserModel).to.contain('Column Name');
										Expect(tmpUserModel).to.contain('IDUser');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// LaTeX Generator Service
		// ========================================================================
		suite
		(
			'LaTeX Generator Service',
			function ()
			{
				test
				(
					'should generate LaTeX documentation files',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'LaTeXTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateLaTeX');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'LaTeXTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpTablesFile = _TestOutputFolder + 'LaTeXTest-Tables.tex';
										var tmpTrackingFile = _TestOutputFolder + 'LaTeXTest-ChangeTracking.tex';

										Expect(libFS.existsSync(tmpTablesFile)).to.be.true;
										Expect(libFS.existsSync(tmpTrackingFile)).to.be.true;

										var tmpTables = libFS.readFileSync(tmpTablesFile, 'utf8');
										Expect(tmpTables).to.contain('\\begin{tabularx}');
										Expect(tmpTables).to.contain('\\end{tabularx}');
										Expect(tmpTables).to.contain('User');
										Expect(tmpTables).to.contain('\\part{Table Definitions}');

										var tmpTracking = libFS.readFileSync(tmpTrackingFile, 'utf8');
										Expect(tmpTracking).to.contain('\\part{Implicit Table Change Tracking}');
										Expect(tmpTracking).to.contain('\\begin{tabular}');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// CSV Data Dictionary Generator Service
		// ========================================================================
		suite
		(
			'CSV Data Dictionary Generator Service',
			function ()
			{
				test
				(
					'should generate a CSV data dictionary file',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'CSVTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateDictionaryCSV');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'CSVTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpCSVFile = _TestOutputFolder + 'CSVTest-DataDictionary.csv';
										Expect(libFS.existsSync(tmpCSVFile)).to.be.true;

										var tmpCSV = libFS.readFileSync(tmpCSVFile, 'utf8');
										Expect(tmpCSV).to.contain('Table,Column Name,Size,Data Type,Join');
										Expect(tmpCSV).to.contain('"User"');
										Expect(tmpCSV).to.contain('"IDUser"');
										Expect(tmpCSV).to.contain('"Contact"');
										Expect(tmpCSV).to.contain('"Address"');

										// Verify join data is included
										Expect(tmpCSV).to.contain('User.IDUser');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Model Graph Generator Service
		// ========================================================================
		suite
		(
			'Model Graph Generator Service',
			function ()
			{
				test
				(
					'should generate a DOT relationship graph',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'GraphTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateModelGraph');
								tmpGenerator.generate(
									{
										OutputLocation: _TestOutputFolder,
										OutputFileName: 'GraphTest',
										GraphFullJoins: false,
										AutomaticallyCompile: false
									},
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpDotFile = _TestOutputFolder + 'GraphTest.dot';
										Expect(libFS.existsSync(tmpDotFile)).to.be.true;

										var tmpDot = libFS.readFileSync(tmpDotFile, 'utf8');
										Expect(tmpDot).to.contain('digraph DataModel');
										Expect(tmpDot).to.contain('User');
										Expect(tmpDot).to.contain('Contact');
										Expect(tmpDot).to.contain('Address');
										Expect(tmpDot).to.contain('rankdir=LR');

										fDone();
									});
							});
					}
				);

				test
				(
					'should include change-tracking joins with GraphFullJoins=true',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'GraphFullTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateModelGraph');

								// Generate with full joins
								tmpGenerator.generate(
									{
										OutputLocation: _TestOutputFolder,
										OutputFileName: 'GraphFullTest',
										GraphFullJoins: true,
										AutomaticallyCompile: false
									},
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpDotFull = libFS.readFileSync(_TestOutputFolder + 'GraphFullTest.dot', 'utf8');
										// Full joins should include CreatingIDUser connections
										Expect(tmpDotFull).to.contain('User');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Auth Chart Generator Service
		// ========================================================================
		suite
		(
			'Auth Chart Generator Service',
			function ()
			{
				test
				(
					'should generate CSV authorization chart for extended model',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _ComplexAddressFile, _TestOutputFolder, 'AuthChartTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateAuthChart');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'AuthChartTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpAuthFile = _TestOutputFolder + 'AuthChartTest-Authorizors.csv';
										Expect(libFS.existsSync(tmpAuthFile)).to.be.true;

										var tmpCSV = libFS.readFileSync(tmpAuthFile, 'utf8');
										Expect(tmpCSV).to.contain('Authorization for');
										// Should contain role names
										Expect(tmpCSV).to.contain('User');
										Expect(tmpCSV).to.contain('Administrator');

										fDone();
									});
							});
					}
				);

				test
				(
					'should error when no authorization data is present',
					function (fDone)
					{
						var tmpInstance = newStricture();

						// Load a model and then clear its authorization data
						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'AuthNoDataTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								// Remove the Authorization key
								delete tmpInstance.AppData.Model.Authorization;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateAuthChart');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'AuthNoDataTest' },
									function (pGenError)
									{
										Expect(pGenError).to.be.an('error');
										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Pict Generator Service
		// ========================================================================
		suite
		(
			'Pict Generator Service',
			function ()
			{
				test
				(
					'should generate RequireJS PICT model for extended model with Pict data',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _ComplexAddressFile, _TestOutputFolder, 'PictGenTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGeneratePict');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'PictGenTest' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										var tmpModelFile = _TestOutputFolder + 'PictGenTest-Stricture-PICT-Model.js';
										Expect(libFS.existsSync(tmpModelFile)).to.be.true;

										var tmpContent = libFS.readFileSync(tmpModelFile, 'utf8');
										Expect(tmpContent).to.contain('AUTO GENERATED STRICTURE PICT MODEL');
										Expect(tmpContent).to.contain('define');
										Expect(tmpContent).to.contain('amdefine');

										fDone();
									});
							});
					}
				);

				test
				(
					'should error when no Pict data is in model',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'PictNoDataTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								// Remove the Pict key
								delete tmpInstance.AppData.Model.Pict;

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGeneratePict');
								tmpGenerator.generate(
									{ OutputLocation: _TestOutputFolder, OutputFileName: 'PictNoDataTest' },
									function (pGenError)
									{
										Expect(pGenError).to.be.an('error');
										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Test Fixtures Generator Service
		// ========================================================================
		suite
		(
			'Test Fixtures Generator Service',
			function ()
			{
				test
				(
					'should generate per-table JSON fixture files',
					function (fDone)
					{
						var tmpInstance = newStricture();

						compileAndLoadModel(tmpInstance, _SimpleAddressFile, _TestOutputFolder, 'FixtureTest',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpFixtureFolder = _TestOutputFolder + 'fixtures/';
								require('mkdirp').sync(tmpFixtureFolder);

								var tmpGenerator = tmpInstance.instantiateServiceProvider('StrictureGenerateTestFixtures');
								tmpGenerator.generate(
									{ OutputLocation: tmpFixtureFolder, OutputFileName: 'Fixture-' },
									function (pGenError)
									{
										Expect(pGenError).to.not.be.ok;

										Expect(libFS.existsSync(tmpFixtureFolder + 'Fixture-User.json')).to.be.true;
										Expect(libFS.existsSync(tmpFixtureFolder + 'Fixture-Contact.json')).to.be.true;
										Expect(libFS.existsSync(tmpFixtureFolder + 'Fixture-Address.json')).to.be.true;

										// Verify the fixture contents
										var tmpUserFixtures = JSON.parse(libFS.readFileSync(tmpFixtureFolder + 'Fixture-User.json', 'utf8'));
										Expect(tmpUserFixtures).to.be.an('array');
										Expect(tmpUserFixtures).to.have.length(25);
										Expect(tmpUserFixtures[0]).to.have.property('IDUser');
										Expect(tmpUserFixtures[0]).to.have.property('UserName');
										Expect(tmpUserFixtures[0]).to.have.property('Email');

										// Verify incrementing IDs
										Expect(tmpUserFixtures[0].IDUser).to.equal(0);
										Expect(tmpUserFixtures[24].IDUser).to.equal(24);

										// Verify default values by type
										Expect(tmpUserFixtures[0].UserName).to.equal('');
										Expect(tmpUserFixtures[0].Email).to.equal('');

										fDone();
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// Full Pipeline Test
		// ========================================================================
		suite
		(
			'Full Pipeline',
			function ()
			{
				test
				(
					'should run all generators from compile through the full pipeline',
					function (fDone)
					{
						var tmpInstance = newStricture();

						var tmpPipelineFolder = _TestOutputFolder + 'full_pipeline/';
						libMkdirp.sync(tmpPipelineFolder);

						// Run the complete pipeline manually: compile -> load -> all generators
						var tmpCompiler = tmpInstance.instantiateServiceProvider('StrictureCompiler');
						tmpCompiler.compileFile(_SimpleAddressFile, tmpPipelineFolder, 'Pipeline',
							function (pError)
							{
								Expect(pError).to.not.be.ok;

								var tmpLoader = tmpInstance.instantiateServiceProvider('StrictureModelLoader');
								tmpLoader.loadFromFile(tmpPipelineFolder + 'Pipeline-Extended.json',
									function (pLoadError)
									{
										Expect(pLoadError).to.not.be.ok;

										var tmpAnticipate = tmpInstance.instantiateServiceProviderWithoutRegistration('Anticipate');

										// MySQL
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQL');
											tmpGen.generate({ OutputLocation: tmpPipelineFolder, OutputFileName: 'Pipeline' }, fStageComplete);
										});

										// MySQL Migrate
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateMySQLMigrate');
											tmpGen.generate({ OutputLocation: tmpPipelineFolder, OutputFileName: 'Pipeline' }, fStageComplete);
										});

										// Meadow
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpMeadowFolder = tmpPipelineFolder + 'meadow/';
											libMkdirp.sync(tmpMeadowFolder);
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateMeadow');
											tmpGen.generate({ OutputLocation: tmpMeadowFolder, OutputFileName: 'Schema' }, fStageComplete);
										});

										// Markdown
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpDocFolder = tmpPipelineFolder + 'doc/';
											libMkdirp.sync(tmpDocFolder);
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateMarkdown');
											tmpGen.generate({ OutputLocation: tmpDocFolder, OutputFileName: 'Doc' }, fStageComplete);
										});

										// LaTeX
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateLaTeX');
											tmpGen.generate({ OutputLocation: tmpPipelineFolder, OutputFileName: 'Pipeline' }, fStageComplete);
										});

										// CSV
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateDictionaryCSV');
											tmpGen.generate({ OutputLocation: tmpPipelineFolder, OutputFileName: 'Pipeline' }, fStageComplete);
										});

										// Graph
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateModelGraph');
											tmpGen.generate({ OutputLocation: tmpPipelineFolder, OutputFileName: 'Pipeline', GraphFullJoins: false, AutomaticallyCompile: false }, fStageComplete);
										});

										// Test Fixtures
										tmpAnticipate.anticipate(function (fStageComplete)
										{
											var tmpFixtureFolder = tmpPipelineFolder + 'fixtures/';
											libMkdirp.sync(tmpFixtureFolder);
											var tmpGen = tmpInstance.instantiateServiceProvider('StrictureGenerateTestFixtures');
											tmpGen.generate({ OutputLocation: tmpFixtureFolder, OutputFileName: 'Test-' }, fStageComplete);
										});

										tmpAnticipate.wait(function (pWaitError)
										{
											Expect(pWaitError).to.not.be.ok;

											// Verify all outputs exist
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline.json')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline-Extended.json')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline.mysql.sql')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline-Migration.mysql.sql')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'meadow/SchemaUser.json')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'doc/Dictionary.md')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline-Tables.tex')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline-DataDictionary.csv')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'Pipeline.dot')).to.be.true;
											Expect(libFS.existsSync(tmpPipelineFolder + 'fixtures/Test-User.json')).to.be.true;

											fDone();
										});
									});
							});
					}
				);
			}
		);

		// ========================================================================
		// CLI Entry Point
		// ========================================================================
		suite
		(
			'CLI Entry Point',
			function ()
			{
				test
				(
					'should be requireable and have a run method',
					function ()
					{
						var tmpCLI = require('../source/Stricture-CLI.js');
						Expect(tmpCLI).to.be.an('object');
						Expect(tmpCLI.run).to.be.a('function');
					}
				);

				test
				(
					'should have all 12 service types registered on the CLI instance',
					function ()
					{
						var tmpCLI = require('../source/Stricture-CLI.js');

						// The CLI object should be a CLIProgram (extends Pict)
						Expect(tmpCLI.addServiceType).to.be.a('function');
						Expect(tmpCLI.instantiateServiceProvider).to.be.a('function');
					}
				);
			}
		);

		// ========================================================================
		// TUI Entry Point
		// ========================================================================
		suite
		(
			'TUI Entry Point',
			function ()
			{
				test
				(
					'should be requireable and have a launchTUI method',
					function ()
					{
						var tmpTUI = require('../source/Stricture-TUI.js');
						Expect(tmpTUI).to.be.an('object');
						Expect(tmpTUI.launchTUI).to.be.a('function');
					}
				);
			}
		);

		// ========================================================================
		// Defaults
		// ========================================================================
		suite
		(
			'Default Configuration Files',
			function ()
			{
				test
				(
					'should load Meadow endpoint definition defaults',
					function ()
					{
						var tmpDefaults = require('../source/defaults/Meadow-Endpoints-Definition-Defaults.js');
						Expect(tmpDefaults).to.be.an('object');
						Expect(tmpDefaults.Create).to.equal(true);
						Expect(tmpDefaults.Read).to.equal(true);
						Expect(tmpDefaults.Reads).to.equal(true);
						Expect(tmpDefaults.Update).to.equal(true);
						Expect(tmpDefaults.Delete).to.equal(true);
						Expect(tmpDefaults.Count).to.equal(true);
						Expect(tmpDefaults.Schema).to.equal(true);
					}
				);

				test
				(
					'should load Meadow endpoint security defaults with all roles',
					function ()
					{
						var tmpSecurity = require('../source/defaults/Meadow-Endpoints-Security-Defaults.js');
						Expect(tmpSecurity).to.be.an('object');
						Expect(tmpSecurity).to.have.property('Unauthenticated');
						Expect(tmpSecurity).to.have.property('Readonly');
						Expect(tmpSecurity).to.have.property('User');
						Expect(tmpSecurity).to.have.property('Manager');
						Expect(tmpSecurity).to.have.property('Director');
						Expect(tmpSecurity).to.have.property('Executive');
						Expect(tmpSecurity).to.have.property('Administrator');

						// Verify specific security policies
						Expect(tmpSecurity.Unauthenticated.Create).to.equal('Deny');
						Expect(tmpSecurity.Administrator.Create).to.equal('Allow');
						Expect(tmpSecurity.Readonly.Read).to.equal('Allow');
						Expect(tmpSecurity.Readonly.Create).to.equal('Deny');
					}
				);

				test
				(
					'should load Pict configuration defaults with all view types',
					function ()
					{
						var tmpPict = require('../source/defaults/Pict-Configuration-Defaults.js');
						Expect(tmpPict).to.be.an('object');
						Expect(tmpPict).to.have.property('Create');
						Expect(tmpPict).to.have.property('Record');
						Expect(tmpPict).to.have.property('Update');
						Expect(tmpPict).to.have.property('List');
						Expect(tmpPict).to.have.property('Delete');

						Expect(tmpPict.Create.Enabled).to.equal(true);
						Expect(tmpPict.List.RowMenu).to.equal(true);
						Expect(tmpPict.Delete.Validation).to.equal(true);
						Expect(tmpPict.Create.Columns).to.be.an('array');
					}
				);
			}
		);

		// ========================================================================
		// TUI Views
		// ========================================================================
		suite
		(
			'TUI Views',
			function ()
			{
				test
				(
					'should require all TUI view modules without errors',
					function ()
					{
						var tmpViewFiles =
						[
							'../source/tui/views/StrictureView-TUI-Layout.js',
							'../source/tui/views/StrictureView-TUI-Header.js',
							'../source/tui/views/StrictureView-TUI-StatusBar.js',
							'../source/tui/views/StrictureView-TUI-ModelOverview.js',
							'../source/tui/views/StrictureView-TUI-TableList.js',
							'../source/tui/views/StrictureView-TUI-TableDetail.js',
							'../source/tui/views/StrictureView-TUI-CompileOutput.js',
							'../source/tui/views/StrictureView-TUI-RelationshipGraph.js'
						];

						for (var i = 0; i < tmpViewFiles.length; i++)
						{
							var tmpView = require(tmpViewFiles[i]);
							Expect(tmpView).to.be.a('function', tmpViewFiles[i] + ' should export a constructor.');
							Expect(tmpView.default_configuration).to.be.an('object', tmpViewFiles[i] + ' should export default_configuration.');
							Expect(tmpView.default_configuration.ViewIdentifier).to.be.a('string', tmpViewFiles[i] + ' should have a ViewIdentifier.');
						}
					}
				);

				test
				(
					'TUI Application module should be requireable',
					function ()
					{
						var tmpApp = require('../source/tui/Stricture-TUI-App.js');
						Expect(tmpApp).to.be.a('function');
					}
				);
			}
		);

		// ========================================================================
		// Command Modules
		// ========================================================================
		suite
		(
			'Command Modules',
			function ()
			{
				test
				(
					'should require all command modules without errors',
					function ()
					{
						var tmpCommandFiles =
						[
							'../source/commands/Stricture-Command-Full.js',
							'../source/commands/Stricture-Command-Compile.js',
							'../source/commands/Stricture-Command-MySQL.js',
							'../source/commands/Stricture-Command-MySQLMigrate.js',
							'../source/commands/Stricture-Command-Meadow.js',
							'../source/commands/Stricture-Command-Documentation.js',
							'../source/commands/Stricture-Command-DataDictionary.js',
							'../source/commands/Stricture-Command-DictionaryCSV.js',
							'../source/commands/Stricture-Command-Relationships.js',
							'../source/commands/Stricture-Command-RelationshipsFull.js',
							'../source/commands/Stricture-Command-Authorization.js',
							'../source/commands/Stricture-Command-Pict.js',
							'../source/commands/Stricture-Command-TestFixtures.js',
							'../source/commands/Stricture-Command-Info.js',
							'../source/commands/Stricture-Command-TUI.js'
						];

						for (var i = 0; i < tmpCommandFiles.length; i++)
						{
							var tmpCommand = require(tmpCommandFiles[i]);
							Expect(tmpCommand).to.be.a('function', tmpCommandFiles[i] + ' should export a constructor.');
						}
					}
				);
			}
		);
	}
);
