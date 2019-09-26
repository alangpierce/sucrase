var sucrase = require('sucrase')
const {Transform , PassThrough} = require('stream')

/** @type import('sucrase').Options */
var sucraseConfig = {transforms: ["typescript", "imports", "jsx"]}


function compile(chunk) {
	return sucrase.transform(chunk, sucraseConfig).code
}


const sucraseStream = (file) => {
	if (!/\.tsx?$|\.jsx?$/.test(file) || file.indexOf("node_modules")>0 || file.indexOf("src")<0) {
		return new PassThrough();
	}
	console.log(file)
	var _transform = new Transform()
	_transform._write = (chunk, encoding, next) => {
  	_transform.push(compile(chunk.toString('utf8')))  
		//_transform.push(compile(file, chunk.toString('utf8')))
	 	next();
	}
	return _transform
}

module.exports = sucraseStream
module.exports.sucrasify = sucraseStream



/** @type import('sucrase').Options */
var sucraseHotConfig = file => ({
  transforms: ["typescript", "imports", "jsx", "react-hot-loader"],
  filePath: file
})


function compileHot(file, chunk) {
	return sucrase.transform(chunk, sucraseHotConfig(file)).code
}


const sucraseHotStream = (file) => {
	if (!/\.tsx?$|\.jsx?$/.test(file) || file.indexOf("node_modules")>0 || file.indexOf("src")<0) {
		return new PassThrough();
	}
	console.log(file)
	var _transform = new Transform()
	_transform._write = (chunk, encoding, next) => {
  	_transform.push(compileHot(file, chunk.toString('utf8')))  
		//_transform.push(compile(file, chunk.toString('utf8')))
	 	next();
	}
	return _transform
}

module.exports.hot = sucraseHotStream
