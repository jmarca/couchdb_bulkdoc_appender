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

function make_inner_handler(hash,opts,next){
    let promise_version = false
    if(! next ){
        promise_version = true
    }
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
        if(opts.auth.username && opts.auth.password){
            req2.auth(opts.auth.username,opts.auth.password)
        }
        req2.send({'docs':revdocs})
        if(promise_version){
            return req2.then( r => {
                return r.body
            })
        }else{
            req2.end(function(e,r){
                if(e){ console.log('bulk doc save error '+e)
                       return next(e)
                     }
                return next(null,r.body)
            })

            return null
        }
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
        let promise_version = false
        if(next===undefined) promise_version = true
        // passed a block of docs.  need to save them. To do so, first
        // request all of the doc ids, and pick off the current
        // revision number for each
        var hash = {}
        var keys = _.map(docs.docs
                        ,function(doc){
                             hash[doc._id] = doc
                             return doc._id;
                        });
        const response_handler = make_inner_handler(hash,opts,next)

        var uri = cdb+ '/_all_docs?include_docs=true';

        var req = superagent.post(uri)
                  .type('json')
                  .set('accept','application/json')
        if(opts.auth.username && opts.auth.password){
            req.auth(opts.auth.username,opts.auth.password)
        }
        //req.send({'include_docs':true})
        req.send({'keys':keys})
        if(promise_version){
            console.log('promise version')
            return req
                .then( response_handler )
                .catch( e=>{
                    console.log('error in request',e)
                    throw e
                })
        }else{
            req.end(function(e,r){
                if(e){
                    return next(e);
                }
                response_handler(r)
                return null
            })
            return null
        }
    }
    if(cb !== null && _.isFunction(cb)){
        return cb(null,saver)
    }else{
        return saver
    }
}

module.exports=make_bulkdoc_saver
