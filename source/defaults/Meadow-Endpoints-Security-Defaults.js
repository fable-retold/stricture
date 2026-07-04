// ##### Part of the **[retold](https://fable-retold.io/)** system
/**
* @license MIT
* @author <steven@velozo.com>
*/

/**
* Meadow Endpoints Default Security
*/

// Some basic macros (might be nice to expose these eventually):
var _DenyAll = (
	{
		Create: 'Deny',

		Read: 'Deny',
		Reads: 'Deny',
		ReadsBy: 'Deny',
		ReadMax: 'Deny',
		ReadSelectList: 'Deny',

		Update: 'Deny',

		Delete: 'Deny',

		Count: 'Deny',
		CountBy: 'Deny',

		Schema: 'Deny',
		Validate: 'Deny',
		New: 'Deny'
	}
);

var _AllowAll = (
	{
		Create: 'Allow',

		Read: 'Allow',
		Reads: 'Allow',
		ReadsBy: 'Allow',
		ReadMax: 'Allow',
		ReadSelectList: 'Allow',

		Update: 'Allow',

		Delete: 'Allow',

		Count: 'Allow',
		CountBy: 'Allow',

		Schema: 'Allow',
		Validate: 'Allow',
		New: 'Allow'
	}
);

var _Readonly = (
	{
		Create: 'Deny',

		Read: 'Allow',
		Reads: 'Allow',
		ReadsBy: 'Allow',
		ReadMax: 'Allow',
		ReadSelectList: 'Allow',

		Update: 'Deny',

		Delete: 'Deny',

		Count: 'Allow',
		CountBy: 'Allow',

		Schema: 'Allow',
		Validate: 'Allow',
		New: 'Deny'
	}
);

var _AllowCustomer = (
	{
		Create: 'Allow',

		Read: 'MyCustomer',
		Reads: 'MyCustomer',
		ReadsBy: 'MyCustomer',
		ReadMax: 'MyCustomer',
		ReadSelectList: 'MyCustomer',

		Update: 'MyCustomer',

		Delete: 'MyCustomer',

		Count: 'MyCustomer',
		CountBy: 'MyCustomer',

		Schema: 'MyCustomer',
		Validate: 'MyCustomer',
		New: 'MyCustomer'
	}
);

var _AllowCustomerMine = (
	{
		Create: 'Allow',

		Read: 'MyCustomer',
		Reads: 'MyCustomer',
		ReadsBy: 'MyCustomer',
		ReadMax: 'MyCustomer',
		ReadSelectList: 'MyCustomer',

		Update: 'Mine',

		Delete: 'Mine',

		Count: 'MyCustomer',
		CountBy: 'MyCustomer',

		Schema: 'MyCustomer',
		Validate: 'MyCustomer',
		New: 'MyCustomer'
	}
);


module.exports = (
	{
		/* ### There are six roles:
		 *
		 * - Role <0: Unauthenticated
		 * - Role 0: Readonly
		 * - Role 1: User
		 * - Role 2: Manager
		 * - Role 3: Director
		 * - Role 4: Executive
		 * - Role 5: Administrator
		 */

		/* ### There are four default authenticators
		 *
		 * - Allow
		 * - Deny
		 * - Mine
		 * - MyCustomer
		 *
		 * These are composable, so you can do an array if the endpoint requires more than one security check.
		 * They must be an array of strings that match the authenticator hashes registered with meadow.
		 */

		// This is used as a pattern for security on any new endpoint
		__DefaultAPISecurity: _DenyAll,

		Unauthenticated: _DenyAll,
		Readonly: _Readonly,
		User: _AllowCustomerMine,
		Manager: _AllowCustomerMine,
		Director: _AllowCustomer,
		Executive: _AllowCustomer,
		Administrator: _AllowAll
	}
);