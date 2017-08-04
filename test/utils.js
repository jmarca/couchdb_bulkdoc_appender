const superagent = require('superagent')

function create_tempdb(config){
    const date = new Date()
    const test_db_unique = [config.couchdb.db,
                          date.getHours(),
                          date.getMinutes(),
                          date.getSeconds(),
                          date.getMilliseconds()].join('-')
    config.couchdb.db = test_db_unique
    const cdb =
        [config.couchdb.host+':'+config.couchdb.port
        ,config.couchdb.db].join('/')

    return superagent.put(cdb)
        .type('json')
        .auth(config.couchdb.auth.username
              ,config.couchdb.auth.password)

}


function teardown(config){
    const cdb =
          config.couchdb.host+':'+config.couchdb.port
          + '/'+ config.couchdb.db
    return superagent.del(cdb)
        .type('json')
        .auth(config.couchdb.auth.username
              ,config.couchdb.auth.password)
}

exports.create_tempdb = create_tempdb
exports.teardown = teardown
