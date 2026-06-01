# Stricture

> **[Read the Stricture Documentation](https://fable-retold.github.io/stricture/)** - interactive docs with the full API reference.

> A Markdown-inspired data definition language and multi-target schema compiler

Stricture is a MicroDDL compiler that turns a simple, line-based schema definition into MySQL scripts, Meadow schema files, relationship diagrams, data dictionaries and test fixtures.  Define your data model once in a human-readable format and generate everything you need for your database, API layer and documentation.

## What's New in v3

Stricture 3.0 is a complete modernization built on the Pict/Fable 3.x service architecture:

- **Service-Oriented Architecture** -- each compiler stage and generator is a standalone Fable service, composable and testable in isolation
- **Modern CLI** -- Commander.js-based CLI via `pict-service-commandlineutility` with subcommands, cascading configuration, and built-in help
- **Interactive TUI** -- browse your data model in a blessed-based terminal interface with table navigation, column inspection and live DDL preview
- **Programmatic API** -- `require('stricture')` returns a Pict instance with all service types pre-registered for use in build scripts and pipelines

### Migrating from v1/v2

The legacy `yargs`-based CLI (`stricture -i Model.mddl -c Full`) has been replaced with Commander subcommands:

```bash
# v1/v2 (legacy)
stricture -i Model.mddl -c Full -f ./model/ -o MeadowModel

# v3
stricture full Model.mddl -o ./model/ -p MeadowModel
```

The JSON model format is unchanged -- v3 reads and writes the same `*.json`, `*-Extended.json` and `*-PICT.json` files.

## Features

- **MicroDDL Language** -- concise, Markdown-inspired syntax for defining tables, columns, types and relationships
- **Multi-Target Output** -- generate MySQL, Meadow schemas, Markdown docs, LaTeX docs, CSV dictionaries, Graphviz diagrams and test fixtures from a single source
- **Relationship Diagrams** -- automatic Graphviz DOT generation with optional image compilation
- **Named Indexes** -- declare regular and unique indexes inline with `+IndexName Col, Col` / `+!IndexName Col` lines that flow through to migration tooling
- **Authorization Definitions** -- declare per-table, per-role security policies inline with your schema
- **PICT UI Definitions** -- define Create, List, Record, Update and Delete view configurations alongside your data model
- **Audit Column Detection** -- magic column names (CreateDate, UpdateDate, Deleted, etc.) are automatically wired into Meadow's audit tracking
- **Include Files** -- split large schemas across multiple MicroDDL files
- **Domain Support** -- organize tables into logical domains within a single model
- **Interactive TUI** -- browse tables, inspect columns and preview generated DDL from the terminal

## Quick Start

```bash
# Install globally for the `stricture` CLI command
npm install -g stricture

# Compile a MicroDDL file through the full pipeline
stricture full Model.mddl

# Or compile only, then generate MySQL separately
stricture compile Model.mddl -o ./model/ -p MeadowModel
stricture mysql ./model/MeadowModel-Extended.json -o ./model/

# Launch the interactive TUI
stricture tui Model.mddl
```

## Installation

```bash
npm install stricture
```

## How It Works

Stricture uses a two-phase approach: first compile the MicroDDL text into an intermediate JSON model, then run one or more generators against that model.

```
MicroDDL Source (.mddl)
  |
  v
Compiler Service (StrictureCompiler)
  |
  +-- MeadowModel.json              (basic table model)
  +-- MeadowModel-Extended.json     (full model with auth + PICT + inline Meadow schemas)
  +-- MeadowModel-PICT.json         (UI definitions)
        |
        +-- MySQL Generator           -> CREATE TABLE scripts
        +-- MySQL Migrate Generator   -> INSERT...SELECT migration stubs
        +-- Meadow Generator          -> per-table schema JSON files
        +-- Markdown Generator        -> data dictionary docs
        +-- LaTeX Generator           -> printable documentation
        +-- CSV Dictionary Generator  -> spreadsheet-friendly dictionary
        +-- Graph Generator           -> Graphviz relationship diagrams
        +-- Auth Chart Generator      -> role/permission CSV matrix
        +-- Pict Generator            -> RequireJS UI model
        +-- Test Fixtures Generator   -> per-table fixture JSON files
```

The `full` command chains Compile, MySQL, Meadow, Markdown and Diagrams in a single pass.

## Programmatic API

```javascript
const Stricture = require('stricture');

// Create an instance -- all 12 service types are registered automatically
let tmpStricture = new Stricture({ Product: 'MyBuild' });

// Compile a MicroDDL file to JSON
let tmpCompiler = tmpStricture.instantiateServiceProvider('StrictureCompiler');
tmpCompiler.compileFile('./Model.mddl', './model/', 'MeadowModel', (pError) =>
{
    if (pError) { console.error(pError); return; }

    // Load the compiled extended model
    let tmpLoader = tmpStricture.instantiateServiceProvider('StrictureModelLoader');
    tmpLoader.loadFromFile('./model/MeadowModel-Extended.json', (pError) =>
    {
        if (pError) { console.error(pError); return; }

        // Generate MySQL CREATE scripts
        let tmpMySQL = tmpStricture.instantiateServiceProvider('StrictureGenerateMySQL');
        tmpMySQL.generate(
            { OutputLocation: './model/', OutputFileName: 'MeadowModel' },
            (pError) =>
            {
                console.log('Done!');
            });
    });
});
```

### Available Service Types

| Service Type | Purpose |
|---|---|
| `StrictureCompiler` | Compile MicroDDL to JSON model files |
| `StrictureModelLoader` | Load compiled JSON and build index lookups |
| `StrictureGenerateMySQL` | MySQL CREATE TABLE statements |
| `StrictureGenerateMySQLMigrate` | MySQL INSERT...SELECT migration stubs |
| `StrictureGenerateMeadow` | Per-table Meadow schema JSON files |
| `StrictureGenerateMarkdown` | Markdown data dictionary documentation |
| `StrictureGenerateLaTeX` | LaTeX data dictionary documentation |
| `StrictureGenerateDictionaryCSV` | CSV data dictionary |
| `StrictureGenerateModelGraph` | GraphViz DOT relationship diagrams |
| `StrictureGenerateAuthChart` | CSV authorization/permission matrix |
| `StrictureGeneratePict` | AMD/RequireJS PICT UI model |
| `StrictureGenerateTestFixtures` | Per-table test fixture JSON files |

## MicroDDL Syntax

### Column Type Symbols

| Symbol | Type       | MySQL Mapping                          | Default Size |
|--------|-----------|----------------------------------------|-------------|
| `@`    | ID         | `INT UNSIGNED NOT NULL AUTO_INCREMENT` | --           |
| `%`    | GUID       | `CHAR(n)`                              | 36          |
| `~`    | ForeignKey | `INT UNSIGNED NOT NULL DEFAULT '0'`    | --           |
| `#`    | Numeric    | `INT NOT NULL DEFAULT '0'`             | int         |
| `.`    | Decimal    | `DECIMAL(p,s)`                         | 10,3        |
| `$`    | String     | `CHAR(n) NOT NULL DEFAULT ''`          | 64          |
| `*`    | Text       | `TEXT`                                  | --           |
| `&`    | DateTime   | `DATETIME`                              | --           |
| `^`    | Boolean    | `TINYINT NOT NULL DEFAULT '0'`         | --           |
| `{`    | JSON       | `LONGTEXT`                              | --           |

The `{` symbol has two forms:

- **`{ColumnName`** -- JSON column where the SQL column and object property share the same name
- **`{VirtualName StorageName`** -- JSON Proxy where the SQL column (`StorageName`) differs from the object property (`VirtualName`)

See [Advanced Column Types](#advanced-column-types) for details and examples.

### Example

```
!User
@IDUser
%GUIDUser
$UserName 128
$Email 256
&CreateDate
#CreatingIDUser -> IDUser
&UpdateDate
#UpdatingIDUser -> IDUser
^Deleted

!Contact
@IDContact
#IDUser -> IDUser
$Name 90
$Email 60
{Preferences
{Tags TagsJSON
&CreateDate
#CreatingIDUser -> IDUser
```

### Joins

Declare foreign key relationships with `->` (column-level) or `=>` (table-level):

```
#IDUser -> IDUser
~CustomerID => Customers
```

### Descriptions

```
>Table description goes here
"ColumnName "Column description goes here"
```

### Include Files and Domains

```
[Domain Reporting]
[Include shared-tables.mddl]
```

### Authorization Stanzas

Define per-table security policies with three tokens per line: `Permission Role Authorizer`

```
[Authorization Inventory]
Read User Mine
Read Manager MyCustomer
Read Executive Deny
Read Administrator Allow
```

Use `*` as the role to apply an authorizer to all roles at once.

### PICT UI Stanzas

Define view configurations for Create, List, Record, Update and Delete operations:

```
[PICT-List User]
(Users)
UserName Type:text Label:"User Name"
Email

[PICT-Record Contact]
(Contact <%= Name %>)
#Person
Name
#Address
City Title:"City of Residence"

[PICT-Delete Address]
:ConfirmationMessage = Are you sure?
```

## Advanced Column Types

### JSON Columns

The `{` symbol defines columns that store structured JSON data. In MySQL, JSON columns are stored as `LONGTEXT` (up to 4GB) to avoid the 64KB limit of `TEXT`. Other SQL databases use `TEXT` (which is unlimited in PostgreSQL and SQLite) or `NVARCHAR(MAX)` (MSSQL). Values are automatically serialized/deserialized by the Meadow provider layer.

#### JSON (Same-Name Storage)

When the SQL column name and JavaScript property name are the same:

```
{Metadata
```

This creates a column called `Metadata` (type `LONGTEXT` in MySQL, `TEXT` in other databases). On write, the object value is `JSON.stringify`'d. On read, the value is `JSON.parse`'d back into an object.

#### JSON Proxy (Different-Name Storage)

When the SQL column name should differ from the JavaScript property name:

```
{Preferences PreferencesJSON
```

This creates a SQL column called `PreferencesJSON` (type `LONGTEXT` in MySQL), but the JavaScript object exposes the data as `Preferences`. The storage column is hidden from API consumers -- they only see the virtual property name.

This is useful when you want a clean API surface (e.g. `record.Preferences`) while keeping a naming convention in your database that makes the storage format explicit (e.g. `PreferencesJSON`).

#### Example

```
!Product
@IDProduct
%GUIDProduct
$Name 128
$SKU 32
{Metadata
{Dimensions DimensionsJSON
&CreateDate
#CreatingIDUser -> IDUser
&UpdateDate
#UpdatingIDUser -> IDUser
^Deleted
```

This produces a table with:
- `Metadata LONGTEXT` -- stores JSON, accessed as `record.Metadata` (an object)
- `DimensionsJSON LONGTEXT` -- stores JSON, accessed as `record.Dimensions` (an object)

#### Generated Output

The Meadow schema generator produces:

```json
{ "Column": "Metadata", "Type": "JSON" }
{ "Column": "Dimensions", "Type": "JSONProxy", "StorageColumn": "DimensionsJSON" }
```

The MySQL DDL generator produces:

```sql
Metadata LONGTEXT,
DimensionsJSON LONGTEXT,
```

## CLI Commands

```bash
stricture [command] [input_file] [options]
```

| Command | Alias | Description |
|---|---|---|
| `full` | | End-to-end pipeline: Compile + MySQL + Meadow + Docs + Diagrams |
| `compile` | `c` | Parse MicroDDL to JSON model files |
| `mysql` | | Generate MySQL CREATE TABLE statements |
| `mysql-migrate` | | Generate INSERT...SELECT migration stubs |
| `meadow` | | Generate per-table Meadow schema JSON files |
| `documentation` | `doc` | Generate Markdown data dictionary |
| `data-dictionary` | `dd` | Generate LaTeX data dictionary |
| `dictionary-csv` | `csv` | Generate CSV data dictionary |
| `relationships` | `rel` | Generate Graphviz diagram (excluding audit joins) |
| `relationships-full` | `relf` | Generate Graphviz diagram (including audit joins) |
| `authorization` | `auth` | Generate CSV authorization/permission matrix |
| `pict` | | Generate RequireJS PICT UI model |
| `test-fixtures` | `tf` | Generate per-table test fixture JSON files |
| `info` | `i` | List all tables in the model |
| `tui` | | Launch the interactive terminal UI |
| `explain-config` | | Show the cascading configuration |

### CLI Options

Each command accepts:

| Option | Description | Default |
|---|---|---|
| `[input_file]` | MicroDDL or compiled JSON model | `./Model.ddl` |
| `-o, --output <folder>` | Output directory | `./model/` |
| `-p, --prefix <name>` | Output file prefix | `MeadowModel` |
| `-g, --generate-image` | Auto-compile DOT to PNG (full/rel commands) | false |

### Cascading Configuration

The CLI loads settings from three sources (later sources override earlier ones):

1. Built-in defaults
2. `~/.stricture-config.json` (home directory)
3. `./.stricture-config.json` (current working directory)

```json
{
    "InputFileName": "./Model.mddl",
    "OutputLocation": "./model/",
    "OutputFileName": "MeadowModel",
    "AutomaticallyCompile": false,
    "AutomaticallyLoad": false
}
```

## Interactive TUI

Launch the terminal UI with:

```bash
stricture tui Model.mddl
```

The TUI provides:

- **Table sidebar** -- navigate tables with arrow keys
- **Model overview** -- table counts, column totals and domain breakdown
- **Table detail** -- inspect columns with types, sizes and join targets
- **Compile output** -- view compilation logs
- **Relationship graph** -- ASCII visualization of table relationships
- **Live DDL preview** -- see generated MySQL for the selected table

Keyboard shortcuts:

| Key | Action |
|---|---|
| Up/Down | Navigate table list |
| Enter | Select table |
| `o` | Model overview |
| `c` | Compile model |
| `g` | Generate all outputs |
| `r` | Show relationships |
| `d` | Show MySQL DDL |
| `q` / Ctrl-C | Quit |

## Special Columns

Certain column names are automatically recognized by Meadow for audit tracking:

| Column Name      | Behavior                                 |
|------------------|------------------------------------------|
| `CreateDate`     | Auto-stamped on record creation          |
| `CreatingIDUser` | Auto-stamped with creating user's ID     |
| `UpdateDate`     | Auto-stamped on record update            |
| `UpdatingIDUser` | Auto-stamped with updating user's ID     |
| `DeleteDate`     | Auto-stamped on soft delete              |
| `DeletingIDUser` | Auto-stamped with deleting user's ID     |
| `Deleted`        | Soft delete flag (meadow filters these)  |
| `IDCustomer`     | Enables `MyCustomer` multi-tenant authz  |

## Meadow Authorization

Roles and their default security policies:

| Role             | Default Policy                        |
|------------------|---------------------------------------|
| Unauthenticated  | Deny all                              |
| Readonly         | Allow reads, deny writes              |
| User             | MyCustomer reads, Mine writes         |
| Manager          | MyCustomer reads, Mine writes         |
| Director         | MyCustomer all                        |
| Executive        | MyCustomer all                        |
| Administrator    | Allow all                             |

Built-in authorizers: `Allow`, `Deny`, `Mine`, `MyCustomer`

## Architecture

Stricture 3.0 is built on the Pict/Fable service provider pattern:

```
Stricture (extends Pict)
  |
  +-- Services (registered via addServiceType)
  |     +-- StrictureCompiler
  |     +-- StrictureModelLoader
  |     +-- StrictureGenerate* (10 generators)
  |
  +-- CLI (pict-service-commandlineutility)
  |     +-- 15 Commander.js subcommands
  |     +-- Cascading .stricture-config.json
  |
  +-- TUI (pict-application + pict-terminalui + blessed)
        +-- 8 Pict views driving blessed widgets
```

Each service extends `fable-serviceproviderbase` and accesses shared state through `this.fable.AppData`:

- `AppData.Model` -- the compiled table model
- `AppData.ModelIndices` -- ID column to table name lookup
- `AppData.ExtendedModel` -- flag for extended vs base model
- `AppData.Stricture` -- raw compiler output

## Testing

```bash
npm test
npm run coverage
```

## Docker Development Environment

```bash
npm run docker-dev-build
npm run docker-dev-run
```

## Related Packages

- [meadow](https://github.com/fable-retold/meadow) -- Data access and ORM
- [foxhound](https://github.com/fable-retold/foxhound) -- Query DSL for SQL generation
- [fable](https://github.com/fable-retold/fable) -- Application services framework
- [pict](https://github.com/fable-retold/pict) -- View and application framework
- [pict-service-commandlineutility](https://github.com/fable-retold/pict-service-commandlineutility) -- CLI framework
- [pict-terminalui](https://github.com/fable-retold/pict-terminalui) -- Terminal UI bridge

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/stevenvelozo/retold/blob/main/docs/contributing.md).
