/* global require console process describe it before after */

const tap = require('tap')
var superagent = require('superagent')

const make_bulkdoc_appender = require('../.')

const path    = require('path')
const rootdir = path.normalize(__dirname)
const config_okay = require('config_okay')
const config_file = rootdir+'/../test.config.json'
const config={}

const utils = require('./utils.js')

tap.plan(1)

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

function populate_db(config){
    const cdb =
        [config.couchdb.host+':'+config.couchdb.port
        ,config.couchdb.db].join('/')

    return superagent.post(cdb+'/_bulk_docs')
        .type('json')
        .send(docs)

}

function testing(t) {
    t.plan(2)
    return t.test(
        'save bulk docs, with some new, some old', tt=>{

            const appender = make_bulkdoc_appender(config.couchdb)
            const newdocs = JSON.parse(JSON.stringify(docs))
            let expected_length = newdocs.docs.length

            newdocs.docs = newdocs.docs.map( doc => {
                doc.altered=true
                return doc
            })
            newdocs.docs.push({'_id':'first'
                               ,'garage':'band'
                               ,'password':'secret'})
            newdocs.docs.push({'_id':'second'
                               ,'garage':'band'
                               ,'password':'secret'})
            expected_length += 2

            appender(newdocs, (err,res) => {
                if(err) console.log(err)
                tt.notOk(err)
                tt.ok(res)
                res.forEach( r => {
                    tt.ok(r)
                    tt.ok(r.ok)
                    tt.ok(r.id)
                    tt.ok(r.rev)
                    if(r.garage!==undefined){
                        tt.is( r.garage,'band' )
                    }
                })

                // then should be able to append to those docs

                newdocs.docs = newdocs.docs.map( doc => {
                    if( doc.garage !== undefined){
                        doc.garage='car'
                    }
                    doc.basement=false
                    return doc
                })
                // also here, make sure that can call as a promise thing
                appender(newdocs)
                    .then( res => {
                        console.log('got response')
                        tt.ok(res)
                        res.forEach( r => {
                            tt.ok(r.ok)
                            tt.ok(r.id)
                            tt.ok(r.rev)
                        })
                        var db = config.couchdb.db
                        var cdb = config.couchdb.host || '127.0.0.1'
                        var cport = config.couchdb.port || 5984
                        cdb = cdb+':'+cport
                        if(! /http/.test(cdb)){
                            cdb = 'http://'+cdb
                        }
                   // cdb += '/'+db
                   // var rq = superagent.get(cdb+'/_all_docs?include_docs=true')
                   //          .type('json')
                   //          .set('accept','application/json')
                   // rq.end(function(e,r){
                   //     // now test that I saved what I expect
                   //     var result = r.body
                   //     expected_length.should.eql(result.rows.length)
                   //     _.each(result.rows,function(row){
                   //         var doc = row.doc
                   //         doc.should.have.property('basement')
                   //         if(doc.garage !== undefined){
                   //             doc.garage.should.eql('car')
                   //         }
                   //     });
                        console.log('ending test')
                        tt.end()
                        return null
                    })
                return null
            })
            return null
        }).then(function(t){
            return t.test(
                'save bulk docs, with nested objects', tt => {

                    const appender = make_bulkdoc_appender(config.couchdb)
                    const newdoc ={"_id": "311831",
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
                    Object.keys(newdoc).forEach( year =>{

                        if(year === '_id') return null
                        newdoc[year] = {'properties':newdoc[year]}
                        // too lazy to fix the above by hand
                        return null
                    })

                    appender({docs:[newdoc]},(err,res) => {
                        tt.notOk(err)
                        tt.ok(res)
                        res.forEach( r => {
                            tt.ok(r)
                            tt.ok(r.ok)
                            tt.ok(r.id)
                            tt.ok(r.rev)
                        })
                        const db = config.couchdb.db
                        let cdb = config.couchdb.host || '127.0.0.1'
                        let cport = config.couchdb.port || 5984
                        cdb = cdb+':'+cport
                        if(! /http/.test(cdb)){
                            cdb = 'http://'+cdb
                        }
                        cdb += '/'+db
                        console.log(cdb)

                        const rq = superagent.get(cdb+'/'+newdoc._id+'?include_docs=true')
                              .type('json')
                              .set('accept','application/json')
                              .then( r => {
                                  tt.ok(r)
                                  tt.ok(r.body)
                                  // now test that I saved what I expect
                                  const doc = r.body
                                  tt.ok(doc['2006'])
                                  tt.ok(doc['2009'])
                                  tt.ok(doc['2014'])
                                  tt.ok(doc.attachment_db)


                                  // should copy new values
                                  tt.same(doc['2006'].properties
                                       ,newdoc['2006'].properties)

                                  // should not destroy old values
                                  tt.same(Object.keys(doc['2009']),
                                          ["vdsdata",
                                           "rawdata",
                                           "row",
                                           "vdsimputed",
                                           "properties",
                                           "truckimputed",
                                           "vdsraw_chain_lengths"])

                                  tt.same(doc['2009'].properties,
                                          newdoc['2009'].properties)

                                  let expected_keys = Object.keys(newdoc)
                                  expected_keys.push("_rev","detached","attachment_db")
                                  // and also from the first test, we
                                  // have altered and basement
                                  expected_keys.push("altered","basement")

                                  tt.same(Object.keys(doc).sort()
                                          ,expected_keys.sort())

                                  tt.end()
                                  return null
                              })
                        return null
                    })
                    return null
                })
        })
}


config_okay(config_file)
    .then( (c) => {
        if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
        config.couchdb = c.couchdb
        return utils.create_tempdb(config)
    })
    .then(()=>{
        return populate_db(config)
    })
    .then(()=>{
        return tap.test('test setting state',testing)
    })
    .then(()=>{
        tap.end()
        return utils.teardown(config)
    })
    .catch(function(e){
        throw e
    })
