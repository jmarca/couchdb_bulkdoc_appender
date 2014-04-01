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
                   ,{"_id": "311831",
                     "2009": { vdsdata: '0',
                               rawdata: '1',
                               row: 1,
                               vdsimputed: 'todo',
                               properties:
                               [ { name: 'Elk Grove Blvd',
                                   cal_pm: '10.859',
                                   abs_pm: 506.15,
                                   latitude_4269: 38.40,
                                   longitude_4269: -121.48,
                                   lanes: 1,
                                   segment_length: null,
                                   freeway: 5,
                                   direction: 'S',
                                   vdstype: 'OR',
                                   district: 3,
                                   "versions": [
                                       "2009-02-05",
                                       "2009-08-19",
                                       "2009-11-19",
                                       "2009-11-20"
                                   ],
                                   "geojson": {
                                       "type": "Point",
                                       "crs": {
                                           "type": "name",
                                           "properties": {
                                               "name": "EPSG:4326"
                                           }
                                       },
                                       "coordinates": [ -121.48,
                                                        38.41
                                                      ]
                                   }
                                 }],
                               truckimputed: '2012-06-10b inprocess',
                               vdsraw_chain_lengths: 'todo'
                             },
                     "detached": { },
                     "attachment_db": "http://192.168.0.1:5984/vdsdata%2ftracking"
                    }
                   ]
           }

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
        superagent.post(cdb+'/_bulk_docs')
        .type('json')
        .set('accept','application/json')
        .auth(config.couchdb.auth.username
             ,config.couchdb.auth.password)
        .send(docs)
        .end(function(e,r){
            return cb(e)
        })
        return null
    })
    return null
}


describe('save bulk docs, with some new, some old',function(){
    var config = {}
    before(function(done){
        config_okay(config_file,function(err,c){
            if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
            config=_.cloneDeep(c)
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
describe('save bulk docs, with nested objects',function(){
    var config = {}
    before(function(done){
        config_okay(config_file,function(err,c){
            if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
            config=_.cloneDeep(c)
            create_tempdb(config,function(){
                var db = config.couchdb.db
                var cdb = config.couchdb.url || '127.0.0.1'
                var cport = config.couchdb.port || 5984
                cdb = cdb+':'+cport
                if(! /http/.test(cdb)){
                    cdb = 'http://'+cdb
                }
                cdb += '/'+db
                var rq = superagent.get(cdb+'/'+docs.docs[2]._id+'?include_docs=true')
                         .type('json')
                         .set('accept','application/json')
                rq.end(function(e,r){
                    // make sure start test with known docexpect
                    var doc = r.body
                    doc.should.not.have.property('2014')
                    doc.should.have.property('2009')
                    doc.should.have.property("attachment_db")
                    return done()
                })

                return null
            })
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
           var newdoc ={"_id": "311831",
                        "2006":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2006-12-30"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2007":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2007-01-09",
                                              "2007-01-24",
                                              "2007-11-22",
                                              "2007-11-29"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2008":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2008-01-12",
                                              "2008-03-08",
                                              "2008-06-13",
                                              "2008-10-16",
                                              "2008-11-15",
                                              "2008-12-03"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2009":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2009-01-07",
                                              "2009-01-10",
                                              "2009-01-30",
                                              "2009-10-08",
                                              "2009-11-11",
                                              "2009-11-19",
                                              "2009-11-20"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2010":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2010-01-01",
                                              "2010-01-05",
                                              "2010-01-07",
                                              "2010-07-21",
                                              "2010-07-29",
                                              "2010-08-14",
                                              "2010-08-27"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2012":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2012-09-22",
                                              "2012-10-04",
                                              "2012-12-28"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2013":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2013-01-31",
                                              "2013-02-02",
                                              "2013-02-07",
                                              "2013-10-04",
                                              "2013-12-20",
                                              "2013-12-31"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}],
                         "2014":[{"name":"Elk Grove Blvd",
                                  "cal_pm":"10.859",
                                  "abs_pm":506.152,
                                  "latitude_4269":"38.409253",
                                  "longitude_4269":"-121.484009",
                                  "lanes":1,
                                  "segment_length":null,
                                  "freeway":5,
                                  "direction":"S",
                                  "vdstype":"OR",
                                  "district":3,
                                  "versions":["2014-01-01",
                                              "2014-01-10",
                                              "2014-01-11",
                                              "2014-01-29",
                                              "2014-02-28"],
                                  "geojson":{"type":"Point",
                                             "crs":{"type":"name",
                                                    "properties":{"name":"EPSG:4326"}},
                                             "coordinates":[-121.483721,
                                                            38.409608]}}]}

           // fix the above
           _.each(newdoc,function(v,year){
               if(year == '_id') return null
               newdoc[year] = {'properties':v}
               // too lazy to fix the above by hand
               return null
           });
           appender({docs:[newdoc]},function(err,res){
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
               var rq = superagent.get(cdb+'/'+newdoc._id+'?include_docs=true')
                        .type('json')
                        .set('accept','application/json')
               rq.end(function(e,r){
                   // now test that I saved what I expect
                   var doc = r.body
                   doc.should.have.property('2006')
                   doc.should.have.property('2009')
                   doc.should.have.property('2014')
                   doc.should.have.property("attachment_db")

                   // should copy new values
                   doc['2006'].properties.should.eql(newdoc['2006'].properties)
                   // should not destroy old values
                   doc['2009'].should.have.keys(["vdsdata",
                                                 "rawdata",
                                                 "row",
                                                 "vdsimputed",
                                                 "properties",
                                                 "truckimputed",
                                                 "vdsraw_chain_lengths"])
                   doc['2009'].properties.should.eql(newdoc['2009'].properties)

                   var expected_keys = Object.keys(newdoc)
                   expected_keys.push("_rev","detached","attachment_db")
                   doc.should.have.keys(expected_keys)


                   return done()
               })
               return null
           })
           return null
       })
    return null
})
