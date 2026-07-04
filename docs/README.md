# Stricture

> A Markdown-inspired data definition language and multi-target schema compiler

Stricture is a MicroDDL compiler that turns a simple, line-based schema definition into MySQL scripts, Meadow schema files, relationship diagrams, data dictionaries and test fixtures.  Define your data model once in a human-readable format and generate everything you need for your database, API layer and documentation.

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

## Quick Start

```bash
# Install globally for the `stricture` CLI command
npm install -g stricture

# Compile a MicroDDL file through the full pipeline
stricture -i Model.mddl -c Full
```

Or run directly from a local checkout:

```bash
node source/Stricture.js -i Model.mddl -c Full -f ./model/ -o MeadowModel
```

## Installation

```bash
npm install stricture
```

## How It Works

Stricture uses a two-phase approach: first compile the MicroDDL text into an intermediate JSON model, then run one or more generators against that model.

<!-- bespoke diagram: edit diagrams/how-it-works.mmd or .hints.json, then: npx pict-renderer-graph build modules/meadow/stricture/docs -->
![How It Works](diagrams/how-it-works.svg)

The `Full` command chains Compile, MySQL, Meadow, Markdown and Diagrams in a single pass.

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
&CreateDate
#CreatingIDUser -> IDUser
```

### Joins

Declare foreign key relationships with `->`:

```
#IDUser -> IDUser
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

```
[PICT-List User]
(Users)
UserName Type:text Label:"User Name"
Email
```

## Commands

| Command               | Description                                          |
|-----------------------|------------------------------------------------------|
| `Full`                | End-to-end pipeline: Compile + MySQL + Meadow + Docs + Diagrams |
| `Compile`             | Parse MicroDDL to JSON model files                   |
| `MySQL`               | Generate MySQL CREATE TABLE statements               |
| `MySQL-Migrate`       | Generate INSERT...SELECT migration stubs             |
| `Meadow`              | Generate per-table Meadow schema JSON files          |
| `Documentation`       | Generate Markdown data dictionary                    |
| `DataDictionary`      | Generate LaTeX data dictionary                       |
| `DictionaryCSV`       | Generate CSV data dictionary                         |
| `Relationships`       | Generate Graphviz diagram (excluding audit joins)    |
| `RelationshipsFull`   | Generate Graphviz diagram (including audit joins)    |
| `Authorization`       | Generate CSV authorization/permission matrix         |
| `Pict`                | Generate RequireJS PICT UI model                     |
| `TestObjectContainers`| Generate per-table test fixture JSON files           |
| `Info`                | List all tables in the model (default fallback)      |

## Command Line Options

| Flag | Option               | Default          | Description                          |
|------|----------------------|------------------|--------------------------------------|
| `-c` | Command              | `Full`           | Command to execute                   |
| `-i` | InputFileName        | `./Model.ddl`    | Input MicroDDL or JSON model file    |
| `-f` | OutputLocation       | `./model/`       | Output directory                     |
| `-o` | OutputFileName       | `MeadowModel`    | Output file prefix                   |
| `-g` | AutomaticallyCompile | `false`          | Auto-generate PNG from DOT files     |
| `-l` | AutomaticallyLoad    | `false`          | Auto-open generated images in the OS |

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

## Documentation

Detailed command documentation is available in the `docs/` folder:

| Document | Description |
|----------|-------------|
| [Stricture-Legacy-Compiler.md](docs/Stricture-Legacy-Compiler.md) | Compiler overview and output structure |
| [MicroDDL-Syntax.md](docs/MicroDDL-Syntax.md) | Full MicroDDL language reference |
| [Command-Compile.md](docs/Command-Compile.md) | Compile command |
| [Command-Full.md](docs/Command-Full.md) | Full pipeline command |
| [Command-MySQL.md](docs/Command-MySQL.md) | MySQL generator |
| [Command-Meadow.md](docs/Command-Meadow.md) | Meadow schema generator |
| [Command-Documentation.md](docs/Command-Documentation.md) | Markdown documentation generator |
| [Command-Relationships.md](docs/Command-Relationships.md) | Graphviz diagram generator |
| [Command-Authorization.md](docs/Command-Authorization.md) | Authorization chart generator |
| [Docuserve-Configuration.md](docs/Docuserve-Configuration.md) | Docuserve file format reference (cover, sidebar, topbar, catalog, search index) |

## Related Packages

- [meadow](https://fable-retold.github.io/meadow/) - Data access and ORM
- [foxhound](https://fable-retold.github.io/foxhound/) - Query DSL for SQL generation
- [fable](https://fable-retold.github.io/fable/) - Application services framework

## License

MIT

## Contributing

Pull requests are welcome. For details on our code of conduct, contribution process, and testing requirements, see the [Retold Contributing Guide](https://github.com/fable-retold/retold/blob/main/docs/contributing.md).
