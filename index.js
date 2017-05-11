"use strict";

var osenv = require("osenv");
var path = require("path");

function normalize(location) {
	return path.posix.normalize(location);
}

function join() {
	return path.posix.join.apply(path.posix.join, arguments);
}

function cwd() {
	var cwd = process.cwd();
	return convertToPosixSlashes(cwd);
}

function home() {
	var home = osenv.home();
	return convertToPosixSlashes(home);
}

//translate relative paths to absolute paths
function toAbsolute(location, relativeTo) {

		//if no location defined, assume cwd
		relativeTo = relativeTo || "";
		relativeTo = convertToPosixSlashes(relativeTo);
		relativeTo = normalize(relativeTo);

		if (relativeTo === ".") relativeTo = cwd();

		location = location || "";
		location = convertToPosixSlashes(location);

		if (location === "") return relativeTo;
		location = location + "";

		var firstCharacter = location.substr(0,1);
		var secondCharacter = location.substr(1,1);

		//take into consideration the ~ home variable
		if (firstCharacter === "~") {
			location = join( home(), location.substr(1));
		}

		var firstCharacter = location.substr(0,1);
		var secondCharacter = location.substr(1,1);
		
		//if path is absolute
		if (firstCharacter === "/" || 
			secondCharacter === ":") return normalize(location);
		
		//if path is not absolute
		return join(relativeTo, location);

	}

function toRelative(location, relativeTo) {
	location = toAbsolute(location);
	relativeTo = toAbsolute(relativeTo);
	var relative =  location.substr(relativeTo.length);
	if (relative[0] = "/") relative = relative.substr(1);
	return relative;
}

function convertToPosixSlashes(location) {
	return location.replace(slashReplaceRegEx, "/");
}


var _locationMap = {};

class Selected extends Array {

	constructor(selectors, relativeTo) {
		super();

		this.relativeTo = relativeTo;
		this.push.apply(this, selectors);

	}

	fileStats(asyncCallback) {


		if (asyncCallback) return this;
	}

	files(asyncCallback) {

		if (asyncCallback) return this;
	}

	dirStats(asyncCallback) {

		if (asyncCallback) return this;
	}

	dirs(asyncCallback) {

		if (asyncCallback) return this;
	}

	allStats(asyncCallback) {

		if (asyncCallback) return this;
	}

	all(asyncCallback) {

		if (asyncCallback) return this;
	}

	add(selectors) {

		return this;
	}

	remove(selectors) {

		return this;
	}

	watchStats(callback) {

		return this;
	}

	watch(callback) {

		return this;
	}

	stopWatchStats(callback) {

		return this;
	}

	stopWatch(callback) {

		return this;
	}

}

module.exports = function Selectors(selectors, relativeTo) { return new Selected(selectors, relativeTo); };
