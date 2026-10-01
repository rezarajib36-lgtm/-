function parseCategoryData(rawName) {
  if (!rawName) return { name: '', portions: [] };
  const match = rawName.match(/\|\|PORTIONS:(.*?)\|\|/);
  if (match) {
    const portions = match[1].split(',').filter(Boolean);
    const name = rawName.replace(match[0], '').trim();
    return { name, portions };
  }
  return { name: rawName, portions: [] };
}

function combineCategoryData(name, portions) {
  let cleanName = name.replace(/\|\|PORTIONS:.*?\|\|/g, '').trim();
  if (portions && portions.length > 0) {
    return `${cleanName} ||PORTIONS:${portions.join(',')}||`;
  }
  return cleanName;
}

console.log(parseCategoryData("Chowmein ||PORTIONS:1 person,3 person||"));
console.log(combineCategoryData("Chowmein", ["1 person", "3 person"]));
