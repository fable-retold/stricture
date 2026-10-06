/**
 * Stricture - MicroDDL Compiler and Multi-Target Schema Code Generator
 *
 * Main module export. Extends Pict (which extends Fable) and registers all
 * Stricture service types so they can be instantiated on demand.
 *
 * Usage (programmatic):
 *   const Stricture = require('stricture');
 *   let tmpStricture = new Stricture({ InputFileName: './Model.ddl' });
 *   let tmpCompiler = tmpStricture.instantiateServiceProvider('StrictureCompiler');
 *   tmpCompiler.compileFile('./Model.ddl', './model/', 'MeadowModel', (pError) => { ... });
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */
const libPict = require('pict');

/**
 * The main Stricture class -- registers all service types on construction.
 *
 * Service types registered:
 *   - StrictureModelLoader   -- loads compiled JSON models
 *   - StrictureCompiler      -- compiles MicroDDL to JSON
 *   - StrictureGenerateMySQL -- MySQL CREATE TABLE statements
 *   - StrictureGenerateMySQLMigrate -- MySQL migration stubs
 *   - StrictureGenerateMeadow -- per-table Meadow schema JSON
 *   - StrictureGenerateMarkdown -- Markdown documentation
 *   - StrictureGenerateLaTeX -- LaTeX documentation
 *   - StrictureGenerateDictionaryCSV -- CSV data dictionary
 *   - StrictureGenerateModelGraph -- GraphViz DOT relationship diagrams
 *   - StrictureGenerateAuthChart -- CSV authorization chart
 *   - StrictureGeneratePict -- AMD/RequireJS PICT model
 *   - StrictureGenerateTestFixtures -- test fixture JSON
 */
class Stricture extends libPict
{
	/**
	 * @param {Object} pSettings - Settings hash passed through to Pict/Fable
	 */
	constructor(pSettings)
	{
		super(pSettings);

		// Initialize AppData namespace for model storage
		if (!this.AppData)
		{
			this.AppData = {};
		}

		// -- Register all Stricture service types --

		// Core services
		this.addServiceType('StrictureModelLoader', require('./services/Stricture-Service-ModelLoader.js'));
		this.addServiceType('StrictureCompiler', require('./services/Stricture-Service-Compiler.js'));

		// Generator services
		this.addServiceType('StrictureGenerateMySQL', require('./services/Stricture-Service-GenerateMySQL.js'));
		this.addServiceType('StrictureGenerateMySQLMigrate', require('./services/Stricture-Service-GenerateMySQLMigrate.js'));
		this.addServiceType('StrictureGenerateMeadow', require('./services/Stricture-Service-GenerateMeadow.js'));
		this.addServiceType('StrictureGenerateMarkdown', require('./services/Stricture-Service-GenerateMarkdown.js'));
		this.addServiceType('StrictureGenerateLaTeX', require('./services/Stricture-Service-GenerateLaTeX.js'));
		this.addServiceType('StrictureGenerateDictionaryCSV', require('./services/Stricture-Service-GenerateDictionaryCSV.js'));
		this.addServiceType('StrictureGenerateModelGraph', require('./services/Stricture-Service-GenerateModelGraph.js'));
		this.addServiceType('StrictureGenerateAuthChart', require('./services/Stricture-Service-GenerateAuthChart.js'));
		this.addServiceType('StrictureGeneratePict', require('./services/Stricture-Service-GeneratePict.js'));
		this.addServiceType('StrictureGenerateTestFixtures', require('./services/Stricture-Service-GenerateTestFixtures.js'));

		// Comparison service
		this.addServiceType('StrictureCompareDDL', require('./services/Stricture-Service-CompareDDL.js'));
	}
}

/**
 * Logical integer types (Signed, Precision, Radix) recorded on compiled columns, and
 * the range comparison schema diffs use.  Exposed statically so consumers can
 * share the exact rules without instantiating Stricture.
 */
Stricture.IntegerTypes = require('./Stricture-IntegerTypes.js');

module.exports = Stricture;
