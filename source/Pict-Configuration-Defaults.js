// ##### Part of the **[retold](https://fable-retold.io/)** system
/**
* @license MIT
* @author <steven@velozo.com>
*/

/**
* Pict Configuration Defaults
*/

module.exports = (
	{
		Create: (
			{
				Enabled: true,
				Columns: [],
				Title: 'Create a <%= EntityName %>'
			}),

		Record: (
			{
				Enabled: true,
				Columns: [],
				Title: 'Read a <%= EntityName %>'
			}),

		Update: (
			{
				Enabled: true,
				Columns: [],
				Title: 'Update a <%= EntityName %>'
			}),

		List: (
			{
				Enabled: true,
				RowMenu: true,
				AddButton: true,
				Columns: [],
				Title: '<%= EntityName %>s'
			}),

		Delete: (
			{
				Enabled: true,
				Validation: true,
				DisplayRecord: true,
				Columns:[],
				ConfirmationMessage: 'Are you sure you want to delete this record with ID XXXXX?',
				Title: 'Delete a <%= EntityName %>'
			})
	}
);