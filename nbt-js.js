/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Types                                                                       *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

var typeFields =
	['name'     , 'structure', 'format'  , 'size'];
	
var types = exports.types =
[
	['end'      , null       , null      , null  ],
	['byte'     , 'word'     , 'Int8'    , 1     ],
	['short'    , 'word'     , 'Int16BE' , 2     ],
	['int'      , 'word'     , 'Int32BE' , 4     ],
	['long'     , 'list'     , 'int'     , 2     ],
	['float'    , 'word'     , 'FloatBE' , 4     ],
	['double'   , 'word'     , 'DoubleBE', 8     ],
	['byteArray', 'list'     , 'byte'    , null  ],
	['string'   , null       , null      , null  ],
	['list'     , 'list'     , null      , null  ],
	['compound' , null       , null      , null  ],
	['intArray' , 'list'     , 'int'     , null  ]
];

types.forEach(function(typeData, typeIndex)
{
	var type = { value: typeIndex };
	typeFields.forEach(function(propertyName, propertyIndex)
	{
		type[propertyName] = typeData[propertyIndex];
	});
	types[type.value] = types[type.name] = type;
});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Reader                                                                      *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

var Reader = exports.Reader = function(buffer)
{
	this.buffer = buffer;
	this.offset = 0;
};

function read(reader, object)
{
	var type = types[reader.byte().payload];
	if (type !== types.end)
	{
		var name = reader.string().payload;
		var result = reader[type.name]();
		object.schema[name] = result.schema;
		object.payload[name] = result.payload;
	}
	return type;
}

types.forEach(function(type)
{
	switch(type.structure)
	{
		case 'word':
			Reader.prototype[type.name] = function()
			{
				var word = this.buffer['read' + type.format](this.offset);
				this.offset += type.size;
				return { schema: type.name, payload: word };
			};
			break;
		case 'list':
			var isList = type === types.list;
			Reader.prototype[type.name] = function()
			{
				var typeName = type.format || types[this.byte().payload].name;
				var result = { schema: isList ? [ typeName ] : type.name, payload: [] };
				var length = type.size || this.int().payload;
				for (var i = 0; i < length; i++)
				{
					var element = this[typeName]();
					if (isList) { result.schema = [ element.schema ]; }
					result.payload.push(element.payload);
				}
				return result;
			};
			break;
	}
});

Reader.prototype[types.string.name] = function()
{
	var length = this.short().payload;
	return new Object
	({
		schema: types.string.name,
		payload: this.buffer.toString('utf8', this.offset, this.offset += length)
	});
};

Reader.prototype[types.compound.name] = function()
{
	var result = { schema: {}, payload: {} };
	while (read(this, result) !== types.end);
	return result;
};

exports.read = function(buffer)
{
	var result = { schema: {}, payload: {} };
	read(new Reader(buffer), result);
	return result;
};