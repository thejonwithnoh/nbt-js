var nbt = exports;

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Types                                                                       *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

var typeFields =
	['name'     , 'structure', 'format'  , 'size'];
	
nbt.types =
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

nbt.types.forEach(function(typeData, typeIndex)
{
	var type = { value: typeIndex };
	typeFields.forEach(function(propertyName, propertyIndex)
	{
		type[propertyName] = typeData[propertyIndex];
	});
	nbt.types[type.value] = nbt.types[type.name] = type;
});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 * Reader                                                                      *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

nbt.Reader = function(buffer)
{
	this.buffer = buffer;
	this.offset = 0;
};

function read(reader, object)
{
	var type = nbt.types[reader.byte().payload];
	if (type !== nbt.types.end)
	{
		var name = reader.string().payload;
		var result = reader[type.name]();
		object.schema[name] = result.schema;
		object.payload[name] = result.payload;
	}
	return type;
}

nbt.types.forEach(function(type)
{
	switch(type.structure)
	{
		case 'word':
			nbt.Reader.prototype[type.name] = function()
			{
				var word = this.buffer['read' + type.format](this.offset);
				this.offset += type.size;
				return { schema: type.name, payload: word };
			};
			break;
		case 'list':
			var isList = type === nbt.types.list;
			nbt.Reader.prototype[type.name] = function()
			{
				var typeName = type.format || nbt.types[this.byte().payload].name;
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

nbt.Reader.prototype[nbt.types.string.name] = function()
{
	var length = this.short().payload;
	return new Object
	({
		schema: nbt.types.string.name,
		payload: this.buffer.toString('utf8', this.offset, this.offset += length)
	});
};

nbt.Reader.prototype[nbt.types.compound.name] = function()
{
	var result = { schema: {}, payload: {} };
	while (read(this, result) !== nbt.types.end);
	return result;
};

nbt.read = function(buffer)
{
	var result = { schema: {}, payload: {} };
	read(new nbt.Reader(buffer), result);
	return result;
};