/* global require console process describe it before after */

var should = require('should')

var _ = require('lodash')
var superagent = require('superagent')

var make_bulkdoc_appender = require('../.')

var env = process.env;
var cuser = env.COUCHDB_USER ;
var cpass = env.COUCHDB_PASS ;
var chost = env.COUCHDB_HOST || 'localhost';
var cport = env.COUCHDB_PORT || 5984;

var test_db ='test%2fbulk%2fappender'
var couch = 'http://'+chost+':'+cport+'/'+test_db

var path    = require('path')
var rootdir = path.normalize(__dirname)
var config_file = rootdir+'/../test.config.json'

var config_okay = require('config_okay')

var docs = {'docs':[{'_id':'doc1'
                    ,foo:'bar'}
                   ,{'_id':'doc2'
                    ,'baz':'bat'}
                   ]}
var created_locally=false

function create_tempdb(config,cb){
    var date = new Date()
    var test_db_unique = [config.couchdb.db,
                          date.getHours(),
                          date.getMinutes(),
                          date.getSeconds(),
                          date.getMilliseconds()].join('-')
    config.couchdb.db = test_db_unique
    var cdb =
        [config.couchdb.url+':'+config.couchdb.port
        ,config.couchdb.db].join('/')

    superagent.put(cdb)
    .type('json')
    .auth(config.couchdb.auth.username
         ,config.couchdb.auth.password)
    .end(function(err,result){
        if(result.error){
            // do not delete if we didn't create
            config.delete_db=false
        }else{
            config.delete_db=true
        }
        cb()
    })
    return null
}


describe('save bulk docs, with some new, some old',function(){
    var config = {}
    before(function(done){
        config_okay(config_file,function(err,c){
            if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
            config = c
            create_tempdb(config,done)
            return null
        })
        return null
    })
    after(function(done){
        var cdb =
            config.couchdb.url+':'+config.couchdb.port
                 + '/'+ config.couchdb.db
        if(config.delete_db){
            superagent.del(cdb)
            .type('json')
            .auth(config.couchdb.auth.username
                 ,config.couchdb.auth.password)
            .end(function(e,r){
                return done()
            })
            return null
        }else{
            console.log("not deleting what I didn't create:" + cdb)
            return done()
        }
    })
    it('should bulk save docs'
      ,function(done){
           var appender = make_bulkdoc_appender(config.couchdb)
           var newdocs = _.clone(docs,true)
           newdocs.docs = _.map(newdocs.docs,function(doc){
                         doc.altered=true
                         return doc
                     })
           newdocs.docs.push({'_id':'first'
                        ,'garage':'band'
                        ,'password':'secret'})
           newdocs.docs.push({'_id':'second'
                        ,'garage':'band'
                        ,'password':'secret'})
           appender(newdocs,function(err,res){
               should.not.exist(err)
               _.each(res,function(r){
                   r.should.have.property('ok')
                   r.should.have.property('id')
                   r.should.have.property('rev')
                   if(r.garage!==undefined){
                       r.garage.should.eql('band')
                   }
               });
               // then should be able to append to those docs
               newdocs.docs = _.map(newdocs.docs,function(doc){
                             if( doc.garage !== undefined){
                                 doc.garage='car'
                             }
                             doc.basement=false
                             return doc
                         })
               appender(newdocs,function(err,res){
                   should.not.exist(err)
                   _.each(res,function(r){
                       r.should.have.property('ok')
                       r.should.have.property('id')
                       r.should.have.property('rev')
                   });
                   var db = config.couchdb.db
                   var cdb = config.couchdb.url || '127.0.0.1'
                   var cport = config.couchdb.port || 5984
                   cdb = cdb+':'+cport
                   if(! /http/.test(cdb)){
                       cdb = 'http://'+cdb
                   }
                   cdb += '/'+db
                   var rq = superagent.get(cdb+'/_all_docs?include_docs=true')
                            .type('json')
                            .set('accept','application/json')
                   rq.end(function(e,r){
                       // now test that I saved what I expect
                       var result = r.body
                       _.each(result.rows,function(row){
                           var doc = row.doc
                           doc.should.have.property('basement')
                           if(doc.garage !== undefined){
                               doc.garage.should.eql('car')
                           }
                       });

                       return done()
                   })
               })
               return null
           })
           return null
       })
    return null
})

// describe('save bulk docs, with all new',function(){
//     var config = {}
//     before(function(done){
//         config_okay(config_file,function(err,c){
//             if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
//             config = c
//             create_tempdb(config,done)
//             return null
//         })
//         return null
//     })
//     after(function(done){
//         var cdb =
//             config.couchdb.url+':'+config.couchdb.port
//                  + '/'+ config.couchdb.db
//         if(config.delete_db){
//             superagent.del(cdb)
//             .type('json')
//             .auth(config.couchdb.auth.username
//                  ,config.couchdb.auth.password)
//             .end(function(e,r){
//                 return done()
//             })
//             return null
//         }else{
//             console.log("not deleting what I didn't create:" + cdb)
//             return done()
//         }
//     })
//     it('should bulk save docs'
//       ,function(done){
//            var appender = make_bulkdoc_appender(test_db)
//            var newdocs = {'docs':[]}
//            newdocs.docs.push({'_id':'anotherfirst'
//                         ,'garage':'band'
//                         ,'password':'secret'})
//            newdocs.docs.push({'_id':'anothersecond'
//                         ,'garage':'band'
//                         ,'password':'secret'})
//            appender(newdocs,function(err,res){
//                should.not.exist(err)
//                _.each(res,function(r){
//                    r.should.have.property('ok')
//                    r.should.have.property('id')
//                    r.should.have.property('rev')
//                });
//                return done()
//            })
//        })
// })
