'use static';

var ASyncIterator = require("./ASyncIterator");

class Stack extends ASyncIterator {

    constructor(first) {
        super();
        this.push(first);
    }

}

module.exports = Stack;