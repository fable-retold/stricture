/**
 * Stricture Integer Types
 *
 * The logical shape of an integer column, in the vocabulary of SQL's
 * INFORMATION_SCHEMA.COLUMNS: `Precision` digits in base `Radix` (2 = bits,
 * 10 = decimal digits), plus `Signed`, an extension the standard lacks.
 * Stricture records this on every integer column it compiles so that each
 * storage engine can choose its own closest native type.  An engine that cannot
 * represent the logical type exactly (MSSQL has no unsigned integers) picks a
 * wider type, and a schema comparison accepts any physical column whose range
 * covers the logical one.
 *
 * The defaults below are what the MySQL generator has always emitted for each
 * DataType, so schemas compiled before these fields existed mean the same thing.
 * See retold/docs/architecture/numeric-type-parity.md for the naming rationale.
 *
 * @license MIT
 * @author Steven Velozo <steven@velozo.com>
 */

/**
 * @typedef {Object} IntegerType
 * @property {boolean} Signed - False when negative values are not representable (SQL's default is true).
 * @property {number} Precision - Number of digits, counted in Radix.
 * @property {number} Radix - 2 when Precision is in bits, 10 when in decimal digits.
 */

/** @type {Record<string, IntegerType>} */
const DATA_TYPE_DEFAULTS = (
	{
		ID: { Signed: false, Precision: 32, Radix: 2 },
		ForeignKey: { Signed: false, Precision: 32, Radix: 2 },
		Numeric: { Signed: true, Precision: 32, Radix: 2 }
	});

// MySQL integer types by storage width in bits, narrowest first.
const MYSQL_INTEGER_TYPES = [ [ 'TINYINT', 8 ], [ 'SMALLINT', 16 ], [ 'MEDIUMINT', 24 ], [ 'INT', 32 ], [ 'BIGINT', 64 ] ];

/**
 * Whether a DataType is stored as an integer.
 *
 * @param {string} pDataType
 * @return {boolean}
 */
function isIntegerDataType(pDataType)
{
	return DATA_TYPE_DEFAULTS.hasOwnProperty(pDataType);
}

/**
 * The logical integer type of a column: its explicit `Signed` / `Precision` /
 * `Radix` when present, otherwise the default for its DataType.  A Precision
 * without a Radix is taken to be in bits.
 *
 * @param {Object} pColumn - A compiled column ({ DataType, Signed?, Precision?, Radix? }).
 * @return {IntegerType|null} Null for non-integer columns.
 */
function getIntegerType(pColumn)
{
	if (!pColumn || !isIntegerDataType(pColumn.DataType))
	{
		return null;
	}
	let tmpDefault = DATA_TYPE_DEFAULTS[pColumn.DataType];
	let tmpHasPrecision = (typeof (pColumn.Precision) === 'number');
	return (
		{
			Signed: (typeof (pColumn.Signed) === 'boolean') ? pColumn.Signed : tmpDefault.Signed,
			Precision: tmpHasPrecision ? pColumn.Precision : tmpDefault.Precision,
			Radix: tmpHasPrecision ? ((typeof (pColumn.Radix) === 'number') ? pColumn.Radix : 2) : tmpDefault.Radix
		});
}

/**
 * Record the logical integer type on a column in place (no-op for other types).
 *
 * @param {Object} pColumn
 * @return {Object} The same column.
 */
function applyIntegerType(pColumn)
{
	let tmpType = getIntegerType(pColumn);
	if (tmpType)
	{
		pColumn.Signed = tmpType.Signed;
		pColumn.Precision = tmpType.Precision;
		pColumn.Radix = tmpType.Radix;
	}
	return pColumn;
}

/**
 * The inclusive range of values an integer type can hold.  In bits, a signed
 * type gives up one bit to the sign; in decimal digits, Precision bounds the
 * magnitude either way.
 *
 * @param {IntegerType} pType
 * @return {{ Min: bigint, Max: bigint }}
 */
function getIntegerRange(pType)
{
	let tmpPrecision = BigInt(pType.Precision);
	if (pType.Radix === 10)
	{
		let tmpMax = (10n ** tmpPrecision) - 1n;
		return { Min: pType.Signed ? -tmpMax : 0n, Max: tmpMax };
	}
	if (!pType.Signed)
	{
		return { Min: 0n, Max: (2n ** tmpPrecision) - 1n };
	}
	return { Min: -(2n ** (tmpPrecision - 1n)), Max: (2n ** (tmpPrecision - 1n)) - 1n };
}

/**
 * Whether every value of the logical type fits in the physical type.  This is
 * the comparison schema diffs use: a column that is wider than asked for is
 * acceptable (it is how an engine without unsigned types stores one); only a
 * column that would reject valid values is a difference.
 *
 * @param {IntegerType} pPhysical - What the column actually is.
 * @param {IntegerType} pLogical - What the schema says it must hold.
 * @return {boolean}
 */
function coversIntegerRange(pPhysical, pLogical)
{
	let tmpPhysical = getIntegerRange(pPhysical);
	let tmpLogical = getIntegerRange(pLogical);
	return (tmpPhysical.Min <= tmpLogical.Min) && (tmpPhysical.Max >= tmpLogical.Max);
}

/**
 * The narrowest MySQL column type holding every value of a logical integer
 * type, e.g. `INT UNSIGNED` for unsigned 32-bit.
 *
 * @param {IntegerType} pType
 * @return {string}
 */
function getMySQLIntegerType(pType)
{
	for (let i = 0; i < MYSQL_INTEGER_TYPES.length; i++)
	{
		let tmpCandidate = { Signed: pType.Signed, Precision: MYSQL_INTEGER_TYPES[i][1], Radix: 2 };
		if (coversIntegerRange(tmpCandidate, pType))
		{
			return pType.Signed ? MYSQL_INTEGER_TYPES[i][0] : `${MYSQL_INTEGER_TYPES[i][0]} UNSIGNED`;
		}
	}
	return pType.Signed ? 'BIGINT' : 'BIGINT UNSIGNED';
}

module.exports = (
	{
		DATA_TYPE_DEFAULTS: DATA_TYPE_DEFAULTS,
		isIntegerDataType: isIntegerDataType,
		getIntegerType: getIntegerType,
		applyIntegerType: applyIntegerType,
		getIntegerRange: getIntegerRange,
		coversIntegerRange: coversIntegerRange,
		getMySQLIntegerType: getMySQLIntegerType
	});
