/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Types                                                                       *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const typeFields =
	['name'     , 'structure', 'format'    , 'size'];

const types = exports.types = [
	['end'      , null       , null        , null  ],
	['byte'     , 'word'     , 'Int8'      , 1     ],
	['short'    , 'word'     , 'Int16BE'   , 2     ],
	['int'      , 'word'     , 'Int32BE'   , 4     ],
	['long'     , 'word'     , 'BigInt64BE', 8     ],
	['float'    , 'word'     , 'FloatBE'   , 4     ],
	['double'   , 'word'     , 'DoubleBE'  , 8     ],
	['byteArray', 'list'     , 'byte'      , null  ],
	['string'   , null       , null        , null  ],
	['list'     , 'list'     , null        , null  ],
	['compound' , null       , null        , null  ],
	['intArray' , 'list'     , 'int'       , null  ]
];

types.forEach((typeData, typeIndex) => {
	const type = {value: typeIndex};
	typeFields.forEach((propertyName, propertyIndex) => type[propertyName] = typeData[propertyIndex]);
	types[type.value] = types[type.name] = type;
});

types.fromSchema = schema => typeof schema === 'string' ? types[schema] :
	(Array.isArray(schema) ? types.list : types.compound);

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Reader                                                                      *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const Reader = exports.Reader = function (buffer) {
	this.buffer = buffer;
	this.offset = 0;
};

function read(reader, object) {
	const type = types[reader.byte().payload];
	if (type !== types.end) {
		const name = reader.string().payload;
		const result = reader[type.name]();
		object.schema[name] = result.schema;
		object.payload[name] = result.payload;
	}
	return type;
}

types.forEach(type => {
	switch (type.structure) {
		case 'word':
			Reader.prototype[type.name] = function () {
				const word = this.buffer['read' + type.format](this.offset);
				this.offset += type.size;
				return {schema: type.name, payload: word};
			};
			break;
		case 'list':
			const isList = type === types.list;
			Reader.prototype[type.name] = function () {
				const typeName = type.format || types[this.byte().payload].name;
				const result = {schema: isList ? [typeName] : type.name, payload: []};
				const length = this.int().payload;
				for (let i = 0; i < length; i++) {
					const element = this[typeName]();
					if (isList) {
						result.schema = [element.schema];
					}
					result.payload.push(element.payload);
				}
				return result;
			};
			break;
	}
});

Reader.prototype[types.string.name] = function () {
	const length = this.short().payload;
	return new Object
	({
		schema: types.string.name,
		payload: this.buffer.toString('utf8', this.offset, this.offset += length)
	});
};

Reader.prototype[types.compound.name] = function () {
	const result = {schema: {}, payload: {}};
	while (read(this, result) !== types.end) {}
	return result;
};

exports.read = buffer => {
	const result = {schema: {}, payload: {}};
	read(new Reader(buffer), result);
	return result;
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Writer                                                                      *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

const write = exports.write = (...args) => write[types.compound.name](...args);

types.forEach(type => {
	switch (type.structure) {
		case 'word':
			write[type.name] = value => {
				const buffer = new Buffer(type.size);
				buffer['write' + type.format](value);
				return buffer;
			};
			break;
		case 'list':
			const isList = type === types.list;
			write[type.name] = (value, schema) => {
				const typeName = isList ? types.fromSchema(schema[0]).name : types[schema].format;
				const buffers = [];
				if (isList) {
					buffers.push(write.byte(types[typeName].value));
				}
				buffers.push(write.int(value.length));
				value.forEach(element => buffers.push(write[typeName](element, schema[0])));
				return Buffer.concat(buffers);
			};
			break;
	}
});

write[types.string.name] = value => {
	const buffer = new Buffer(value, 'utf8');
	return Buffer.concat([write.short(buffer.length), buffer]);
};

write[types.compound.name] = (value, schema) => {
	const buffers = [];
	for (const name in value) {
		const type = types.fromSchema(schema[name]);
		buffers.push(write.byte(type.value));
		buffers.push(write.string(name));
		buffers.push(write[type.name](value[name], schema[name]));
	}
	buffers.push(write.byte(types.end.value));
	return Buffer.concat(buffers);
};
