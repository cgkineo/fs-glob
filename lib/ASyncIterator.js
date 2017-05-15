'use strict';

var util = require("./util.js");

class ASyncIterator extends Array {

    constructor() {
        super(0);
    }

    each(callback, options) {

        options = util.defaults(options, {
            sync: false
        });

        var item;
        var index = 0;

        if (options.sync) {

            var cont = true;

            var noop = function noop(passed) {
                if (passed === false) {
                    index--;
                    this.splice(index,1);
                    
                }
                cont = true;
            }.bind(this);
            
            while (cont && index < this.length && index > -1 && this.length > 0) {

                item = this[index];
                index++;
                cont = false;
                callback(item, noop);
                
            }

            callback(null);

        } else {

            var next = function eachNext() {

                if (index >= this.length || this.length === 0 || index < 0) {
                    return callback(null);
                }

                item = this[index];
                index++;
                callback(item, cont);
                
            }.bind(this);

            var cont = function eachCont(passed) {

                if (passed === false) {
                    index--;
                    this.splice(index,1);
                }
                util.repeater(next);

            }.bind(this);
            
            cont();

        }

        return this;

    }

    reverseEach(callback, options) {

        options = util.defaults(options, {
            sync: false
        });
        
        var item;
        var index = this.length-1;

        if (options.sync) {

            var cont = true;

            var noop = function noop(passed) {
                if (passed === false) {
                    index++;
                    this.splice(index,1);
                    
                }
                cont = true;
            }.bind(this);
            
            while (cont && index > -1 && index > -1 && this.length > 0) {

                item = this[index];
                index--;
                cont = false;
                callback(item, noop);

            }

            callback(null);


        } else {

            var next = function reverseEachNext() {

                if (index < 0 || this.length === 0 || index >= this.length) {
                    return callback(null);
                }

                item = this[index];
                index--;
                callback(item, cont);

            }.bind(this);

            var cont = function eachCont(passed) {

                if (passed === false) {
                    index++;
                    this.splice(index,1);
                }
                util.repeater(next);

            }.bind(this);
            
            cont();

        }

        return this;

    }

}

module.exports = ASyncIterator;