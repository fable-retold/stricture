# Stricture

> A Markdown-inspired data definition language and multi-target schema compiler

Define your data model once in MicroDDL and generate MySQL scripts, Meadow schemas, relationship diagrams, data dictionaries, test fixtures, and documentation from a single source.

- **MicroDDL Language** - concise, Markdown-inspired syntax for tables, columns, types, indexes, and relationships
- **Multi-Target Output** - MySQL DDL, Meadow schemas, Markdown / LaTeX docs, CSV dictionaries, Graphviz diagrams, test fixtures
- **Named Indexes** - declare regular and unique indexes inline with `+` lines that flow through to migration tooling
- **Authorization Definitions** - per-table, per-role security policies inline with the schema
- **PICT UI Definitions** - Create / List / Record / Update / Delete view configurations alongside the data model
- **Magic Audit Columns** - `CreateDate`, `UpdateDate`, `Deleted`, etc. are automatically wired into Meadow's audit tracking

[Get Started](MicroDDL-Syntax.md)
[GitHub](https://github.com/fable-retold/stricture)
[npm](https://www.npmjs.com/package/stricture)
