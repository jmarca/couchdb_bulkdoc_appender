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

const docids = [1,2,3,4,5,6,7,8,9].map( d => { return 'tams'+d })
const years = [
    1,2
    ,3,4,5,6
    ,7,8,9
    ,10,11
    //,12,13,14,15,16,17,18,18,18
              ].map( y =>{return 2010 + y} )


function testing(t) {
    t.plan(2)
    return t.test(
        'churn out one push per year',tt =>{

            const appender = make_bulkdoc_appender(config.couchdb)
            const jobs = []
            years.forEach( y =>{
                const newdocs = docids.map( id =>{
                    const newdoc = { '_id': id }
                    newdoc[y] = {'mega':'productive'}
                    return newdoc
                })
                // save that away
                const yearly_job = appender({docs:newdocs})
                      .then( results =>{
                          // expect results is okay across all docs
                          tt.ok(results)
                          results.forEach( r => {

                              tt.ok(r.ok)
                              tt.ok(r.id)
                              tt.ok(r.rev)
                              if(!r.ok){
                                  console.log(r)
                              }
                          })
                      })
                      .catch(e =>{
                          console.log(e)
                          tt.fail('caught in job with year',y)
                          throw e
                      })
                jobs.push(yearly_job)
            })
            Promise.all(jobs)
                .then( results =>{
                    // all done with this test
                    tt.end()
                })
                .catch(e=>{
                    tt.fail('caught error in promise.all')
                    throw e
                })
        })
        .then( (t) => {
            return t.test('overload the conflict resolver',tt =>{
                const appender = make_bulkdoc_appender(config.couchdb)
                const jobs = []
                let conflicts = 0
                years.concat(years).forEach( y =>{
                    const newdocs = docids.map( id =>{
                        const newdoc = { '_id': id }
                        newdoc[y] = {'mega':'productive'}
                        return newdoc
                    })
                    // save that away
                    // expect to get conflicts at some point

                    const yearly_job = appender({docs:newdocs})
                        .then( results =>{
                            // expect results is okay across all docs
                            tt.ok(results,'appender completed')
                            results.forEach( r => {
                                if(r.ok === undefined && r.error=='conflict'){
                                    conflicts++
                                }
                            })
                        })
                        .catch(e =>{
                            console.log(e)
                            tt.fail('caught in job with year',y)
                            throw e
                        })
                    jobs.push(yearly_job)
                })
                Promise.all(jobs)
                    .then( results =>{
                        tt.ok(conflicts > 0,'got some conflicts after all')
                        // all done with this test
                        tt.end()
                    })
                    .catch(e=>{
                        tt.fail('caught error in promise.all')
                        throw e
                    })
            })
        }).catch(e=>{
            t.fail('caught error in outer test')
            throw e
        })
}


config_okay(config_file)
    .then( (c) => {
        if(!c.couchdb.db){ throw new Error('need valid db defined in test.config.json')}
        config.couchdb = c.couchdb
        return utils.create_tempdb(config)
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
