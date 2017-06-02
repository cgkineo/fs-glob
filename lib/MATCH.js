'use strict';

var util = require("./util");

class MATCH {

    constructor() {
    	this.NEGATE = 0;
    	this.DESCEND = 1;
    	this.MATCH = 2;
    }

}

module.exports = util.MATCH = new MATCH();