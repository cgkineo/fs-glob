'use strict';

var ASyncIterator = require("./ASyncIterator");
var util = require("./util");

class Stack extends ASyncIterator {

    constructor(first) {
        super();
        this.push(first);
    }

}

module.exports = util.Stack = Stack;