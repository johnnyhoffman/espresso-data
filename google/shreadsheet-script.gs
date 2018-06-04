function onOpen() {
    var ui = SpreadsheetApp.getUi();
    // Or DocumentApp or FormApp.
    ui.createMenu('Custom Menu')
        .addItem('Push To Website', 'pushToWebsite')
        .addToUi();
}

function pushToWebsite() {
    var sheet = SpreadsheetApp.getActiveSheet();
    var data = transform(sheet.getDataRange().getDisplayValues());
    // ADD CODE TO PUSH TO WEBSITE HERE
}

function transform(inputData) {
    if (!inputData)
        throw new Error('empty input data');
    if (inputData.length < 4)
        throw new Error('input data must have at least 4 rows');
    var names = inputData[0];
    var columnCount = names.length;
    inputData.forEach(function (o, i) { if (o.length !== columnCount) throw new Error('expected ' + columnCount + ' columns but row ' + i + ' has ' + o.length); });
    names.forEach(function (o, i) { if (!o.length) throw new Error('name for column ' + i + ' cannot be blank'); });
    var types = inputData[1].map(function (o) { return o.toLowerCase(); });
    var superProperties = inputData[3].map(function (o) { return o.split(',').map(function(x) { return x.trim(); }).filter(function(x) { return x; }); });
  
    types.forEach(function (o, i) { if (['numeric', 'discrete', 'string'].indexOf(o) < 0) throw new Error('type "' + o + '" for column ' + i + ' is invalid'); });
    var superPropertyColumnDefinitions = superProperties
        // selectMany
        .reduce(function(a, b) { return a.concat(b); })
        // distinct
        .filter(function (value, index, self) { 
            return self.indexOf(value) === index;
        })
        .map(function (o) {
              return { name: o, type: 'numeric' };
        });

    var columnDefinitions = inputData[2]
        .map(function (o, i) {
            var name = names[i];
            var type = types[i];
            var superPropertyList = superProperties[i];
            if (type === 'numeric') {
                if (!o) return { name: name, type: type };
                var split = o.split('-').map(function (n) {
                    var representation = n.trim();
                    // unbounded
                    if (!representation)
                        return undefined;
                    var num = Number(representation);
                    if (isNaN(num)) throw new Error('numeric range "' + o + '" is invalid');
                    return num;
                });
                if (split.length !== 2) throw new Error('numeric range "' + o + '" is invalid');
                return { name: name, type: type, min: split[0], max: split[1] };
            } else {
                if (superPropertyList.length > 0) throw new Error('non-numeric range "' + o + '" cannot have super-properties');
            }
            if (type === 'discrete') {
                if (!o.replace(',', '').trim()) throw new Error('disrete range "' + o + '" is invalid');
                return { name: name, type: type, discreteRange: o.split(',').map(function (d) { return d.trim(); }).filter(function (d) { return o.length; }) };
            }
            // default happen when type === 'string'
            return { name: name, type: type };
         })
         .concat(superPropertyColumnDefinitions);
    
    var values = inputData
        .slice(4)
        .map(function (o) {
            var superPropertyValues = superPropertyColumnDefinitions.map(function() { return null; });
            return o.map(function (v, i) {
                v = v.trim();
                // valid to have missing value
                if (!v) return undefined;
                var definition = columnDefinitions[i];
                if (definition.type === 'discrete') {
                    if (definition.discreteRange.map(function (d) { return d.toLowerCase(); }).indexOf(v.toLowerCase()) < 0)
                        throw new Error('value "' + v + '" not valid for discrete range ' + JSON.stringify(definition.discreteRange));
                    return v;
                }
                if (definition.type === 'numeric') {
                    var num = Number(v);
                    if (isNaN(num)) throw new Error('number "' + v + '" is invalid');
                    if (definition.min !== undefined && num < definition.min || definition.max !== undefined && num > definition.max)
                        throw new Error('number "' + num + '" not in range(' + definition.min + ', ' + definition.max + ')');
                    superProperties[i].forEach(function(superProperty) {
                        var superIndex = superPropertyColumnDefinitions.map(function(o, i2) { return {o: o, i: i2}}).filter(function(o) { return o.o.name === superProperty; })[0].i;
                        superPropertyValues[superIndex] = superPropertyValues[superIndex] ? superPropertyValues[superIndex] + num : num;
                    });
                    return num;
                }
                return v;
            })
            .concat(superPropertyValues);;
        });
    return { columnCount: columnCount, columnDefinitions: columnDefinitions, values: values };
};