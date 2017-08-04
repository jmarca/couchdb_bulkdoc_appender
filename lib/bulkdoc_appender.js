var _ = require('lodash')
var superagent = require('superagent')

/**
 * make_bulkdoc_appender
 * initialize with options, optional callback
 *
 * opts object:
 * {
 *     db: the couchdb database name
 *     url: the couchdb url, defaults to  '127.0.0.1'
 *     port: the couchdb port, defaults to 5984
 *     auth: { 'username': couchdb user name
 *            ,'password': couchdb password
 *           } // optional, but needed if your db requires it
 * }
 *
 * will either return the saver, or send it to the callback as the second argument
 *
 * then, with the returned function, to save bulkdocs, call with
 * saver({docs:[doc1,doc2,doc3,...],
 *       function(e,response){ callback function} )
 *
 * The first argument to the callback is whether there is an error in
 * the requqest, the second is the json object returned from couchdb,
 * whcih should have the save state of each document (ok or rejected,
 * depending)
 *
 * By using this library, there *should* be no rejected cases, but it
 * is possible that you might get a race condition where two requests
 * are trying to simultaneously save the same doc, and the other one
 * wins.  In which case, check this object that each doc response has
 * ok in it, and if not, just resubmit the request for those docs.
 *
 */

/**
 * recursive_assign
 *
 * The hope here is to recursively assign elements from b to a The use
 * case is with a CouchDB document, in which a has everything, and b
 * has some parts of a that need to changed, and other elements that
 * are now and not yet part of a.  Nothing can be deleted from a with
 * this function, but that's okay.  This is inside a function called
 * "updater" after all!
 * @param {Object} a some document
 * @param {Object} b another document, containing things to update and
 *                 add to "a" document
 * @returns {Object} a, with the contents of b recursively assigned into a
 */
function recursive_assign(a,b){
    if(a === undefined){
        return b
    }
    if(b === undefined){
        return a
    }
    if(! _.isObject(b) ){
        return b
    }
    _.each(b,function(v,k){
        if(_.isPlainObject(a[k])){
            var q = a[k]
            a[k] = _.assign(q,v,recursive_assign)

        }else{
            a[k]=v
        }
        return null
    });
    return a
}

// but that is possibly dumb.  If I hit errors or issues, should
// consider using lodash's merge

const  auth_check = (r,opts)=>{
    if(opts.auth.username && opts.auth.password){
        r.auth(opts.auth.username,opts.auth.password)
    }
    return r
}


function make_inner_handler(hash,opts){
    const cdb = make_cdb_from_opts(opts)

    return (r) => {
        // now add the revisions to the docs and save updates
        var result = r.body
        var revdocs = []
        var newdocs = []
        result.rows.forEach(function(row){
            if(row.error==='not_found') return hash[row.key]
            if(row.error) throw new Error(row.error)
            //hash[row.id]._rev = row.value.rev // verify rev is latest
            // now copy old values
            row.doc = recursive_assign(row.doc,hash[row.id])
            delete hash[row.id]
            revdocs.push(row.doc)
            return null
        })
        _.forEach(hash,function(value,key){
            revdocs.push(value)
            return null
        })

        let uri = cdb+ '/_bulk_docs';
        var req2 = superagent.post(uri)
            .type('json')
            .set('accept','application/json')
        auth_check(req2,opts)
        req2.send({'docs':revdocs})
        return req2.then( r => {
            console.log('returning the body',r.body)
            return r.body
        }).catch( e => {
            console.log('caught error in inner handler',uri,e)
            throw e
        })
    }
}

function make_cdb_from_opts(opts){
    var db = opts.db
    var cdb = opts.url || '127.0.0.1'
    var cport = opts.port || 5984
    cdb = cdb+':'+cport
    if(! /http/.test(cdb)){
        cdb = 'http://'+cdb
    }
    cdb += '/'+db
    return cdb
}

function  make_bulkdoc_saver(opts,cb){
    const cdb = make_cdb_from_opts(opts)
    function saver(docs,next){
        const has_callback = typeof next === 'function'

        // passed a block of docs.  need to save them. To do so, first
        // request all of the doc ids, and pick off the current
        // revision number for each
        var hash = {}
        var keys = _.map(docs.docs
                        ,function(doc){
                             hash[doc._id] = doc
                             return doc._id;
                        });
        const response_handler = make_inner_handler(hash,opts)

        var uri = cdb+ '/_all_docs?include_docs=true';

        let req = superagent.post(uri)
                  .type('json')
                  .set('accept','application/json')
        auth_check(req,opts)
        //req.send({'include_docs':true})
        req.send({'keys':keys})
        req = req.then( response_handler )

        if(has_callback){
            console.log('callback version')
            req.then( r => {
                return next(null,r)
            })
            .catch( e=>{
                console.log('error handler, callback version')
                return next(e)
            })
            return null
        }else{
            return req
        }
    }
    if(cb !== null && _.isFunction(cb)){
        return cb(null,saver)
    }else{
        return saver
    }
}

module.exports=make_bulkdoc_saver
