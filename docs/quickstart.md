# Quick Start

This guide walks you through installing Stricture, writing a minimal MicroDDL
schema, and running the CLI to compile it into JSON, MySQL DDL, Meadow schemas
and documentation.

## Installation

Install globally to get the `stricture` command on your `PATH`:

```bash
npm install -g stricture
```

Or install it as a project dependency to use the programmatic API and run the
CLI through `npx`:

```bash
npm install stricture
```

## Write a Minimal Schema

MicroDDL is a line-oriented language: each line is parsed on its first
character. Create a file named `Model.mddl`:

```
/ A minimal two-table model

!User
>The primary user table for authentication and identity.
@IDUser
%GUIDUser
$UserName 128
$Email 256
^Active
&CreateDate
#CreatingIDUser -> IDUser
&UpdateDate
#UpdatingIDUser -> IDUser
^Deleted

!Contact
>A contact belonging to a user.
@IDContact
#IDUser -> IDUser
$Name 90
$Email 60
{Preferences
&CreateDate
#CreatingIDUser -> IDUser
^Deleted
```

What the symbols mean:

- `!User` opens a table stanza; every column line below belongs to it until the
  blank line.
- `>` adds a table description.
- `@` is an auto-increment ID, `%` a GUID, `$` a sized string, `^` a boolean,
  `&` a datetime, `#` an integer, and `{` a JSON column.
- `#CreatingIDUser -> IDUser` declares a foreign-key join to the table that owns
  `IDUser` as its primary key.
- `CreateDate`, `UpdateDate`, `Deleted` and the `*IDUser` columns are magic
  names that wire up Meadow's automatic audit tracking and soft deletes.

See the [MicroDDL Syntax](MicroDDL-Syntax.md) reference for the full symbol
table, indexes, authorization stanzas and PICT UI stanzas.

## Compile to a JSON Model

The `compile` command parses the MicroDDL into intermediate JSON model files.
By default it writes to `./model/` with the prefix `MeadowModel`:

```bash
stricture compile Model.mddl
```

To choose the output folder and file prefix explicitly:

```bash
stricture compile Model.mddl -o ./model/ -p MeadowModel
```

This writes three files:

- `MeadowModel.json` -- the basic table model
- `MeadowModel-Extended.json` -- the full model (authorization, endpoints, PICT
  config, and inline Meadow schemas)
- `MeadowModel-PICT.json` -- any PICT UI definitions

Generators read the **extended** model, so point subsequent commands at
`MeadowModel-Extended.json`. See [Compile](Command-Compile.md) for the full
model structure.

## Generate MySQL DDL

Produce `CREATE TABLE` statements from the compiled model:

```bash
stricture mysql ./model/MeadowModel-Extended.json -o ./model/ -p MeadowModel
```

This writes `MeadowModel.mysql.sql`, containing a
`CREATE TABLE IF NOT EXISTS` statement per table with `utf8mb4` collation. See
[MySQL DDL](Command-MySQL.md) for the type mappings and an example of the
generated SQL.

## Generate Meadow Schemas

Produce one Meadow schema JSON file per table -- the format a
[Meadow](https://fable-retold.github.io/meadow/) data access layer loads
directly:

```bash
stricture meadow ./model/MeadowModel-Extended.json -o ./model/meadow/ -p MeadowSchema
```

You get `MeadowSchemaUser.json` and `MeadowSchemaContact.json`, each containing
the `Scope`, `DefaultIdentifier`, `Schema` array, `DefaultObject`, JSON Schema
and (from the extended model) the per-table authorization block. See
[Meadow Schemas](Command-Meadow.md) for the type mappings.

## Generate Documentation

Produce a Markdown data dictionary from the compiled model:

```bash
stricture documentation ./model/MeadowModel-Extended.json -o ./model/doc/ -p Documentation
```

This writes a dictionary index, a per-table detail page, and a change-tracking
matrix. The `doc` alias is equivalent:

```bash
stricture doc ./model/MeadowModel-Extended.json -o ./model/doc/
```

See [Documentation](Command-Documentation.md) for the generated file layout and
link format.

## Do It All at Once

The `full` command runs the common path end-to-end: it compiles the MicroDDL,
then generates MySQL DDL, Meadow schemas, Markdown documentation and
relationship diagrams, each into its own subdirectory under the output folder:

```bash
stricture full Model.mddl -o ./model/ -p MeadowModel
```

Add `-g` to also compile the relationship diagrams to PNG images (requires
[Graphviz](Command-Relationships.md) to be installed):

```bash
stricture full Model.mddl -o ./model/ -g
```

`full` does not run every generator -- LaTeX docs, the CSV dictionary, the
authorization matrix, the PICT UI model, MySQL migration stubs and test
fixtures are separate commands. See [Full Pipeline](Command-Full.md) for the
complete stage list and output tree.

## Inspect a Compiled Model

To confirm a model compiled correctly, list its tables:

```bash
stricture info ./model/MeadowModel-Extended.json
```

This prints the table count and each table name to the console without writing
any files. See [Info](Command-Info.md) for details.

## Explore Interactively

Launch the terminal UI to browse tables, inspect columns and preview generated
DDL:

```bash
stricture tui Model.mddl
```

## Configuration

Every command accepts `-o, --output <folder>` and `-p, --prefix <name>`. The
diagram-producing commands also accept `-g, --generate-image`. Defaults cascade
from three sources, with later sources overriding earlier ones:

1. Built-in defaults (`InputFileName: ./Model.ddl`, `OutputLocation: ./model/`,
   `OutputFileName: MeadowModel`)
2. `~/.stricture-config.json` in your home directory
3. `./.stricture-config.json` in the current working directory

```json
{
    "InputFileName": "./Model.mddl",
    "OutputLocation": "./model/",
    "OutputFileName": "MeadowModel"
}
```

Run `stricture explain-config` to see the effective configuration after the
cascade is applied.

## Using the Programmatic API

When you need Stricture inside a build script, `require('stricture')` returns a
Pict-derived constructor that registers every service type. Compile a file,
load the extended model, then run a generator:

```javascript
const libStricture = require('stricture');

let pSettings = { Product: 'MyBuild' };
let tmpStricture = new libStricture(pSettings);

let tmpCompiler = tmpStricture.instantiateServiceProvider('StrictureCompiler');
tmpCompiler.compileFile('./Model.mddl', './model/', 'MeadowModel',
	(pError) =>
	{
		if (pError)
		{
			console.error(pError);
			return;
		}

		let tmpLoader = tmpStricture.instantiateServiceProvider('StrictureModelLoader');
		tmpLoader.loadFromFile('./model/MeadowModel-Extended.json',
			(pError) =>
			{
				if (pError)
				{
					console.error(pError);
					return;
				}

				let tmpMySQL = tmpStricture.instantiateServiceProvider('StrictureGenerateMySQL');
				tmpMySQL.generate({ OutputLocation: './model/', OutputFileName: 'MeadowModel' },
					(pError) =>
					{
						console.log('Done.');
					});
			});
	});
```

See the [Architecture](architecture.md) page for the full list of service types
and how the pipeline fits together.

## Related Modules

- [Meadow](https://fable-retold.github.io/meadow/) -- the data access layer that
  loads the Meadow schemas Stricture generates
- [FoxHound](https://fable-retold.github.io/foxhound/) -- the query DSL Meadow
  uses to turn those schemas into SQL
- [meadow-endpoints](https://fable-retold.github.io/meadow-endpoints/) -- builds
  RESTful CRUD endpoints from Meadow schemas, honoring the authorization rules
  Stricture compiles
- [precedent](https://fable-retold.github.io/precedent/) -- the
  identity/sequence library used across the data layer
