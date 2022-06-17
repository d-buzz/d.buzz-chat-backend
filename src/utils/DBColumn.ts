import { Column, ColumnOptions, ColumnType } from 'typeorm';

const sqliteMapping: { [key: string]: ColumnType } = {
  'json': 'varchar',
  'timestamp': 'bigint',
};

function resolveDbType(postgresType: ColumnType): ColumnType {
  	const useSQLITE = process.env.DB_TYPE === 'sqlite';
    var type = postgresType.toString();
  	if(useSQLITE && type in sqliteMapping) 
		return sqliteMapping[type];
	return postgresType;
}

export function DBColumn(columnOptions?: ColumnOptions) {
  if(columnOptions === undefined) return Column();
  if(columnOptions.type) {
    columnOptions.type = resolveDbType(columnOptions.type);
    if(columnOptions.type === 'json' && columnOptions.length !== undefined) {
        //postgress does not support length property for json
        delete columnOptions["length"];
    }
  }
  return Column(columnOptions);
}
