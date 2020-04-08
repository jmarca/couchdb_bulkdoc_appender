
# couchdb_bulkdoc_appender


[![Build Status](https://travis-ci.org/jmarca/couchdb_bulkdoc_appender.svg?branch=master)](https://travis-ci.org/jmarca/couchdb_bulkdoc_appender)
[![Code Climate](https://codeclimate.com/github/jmarca/couchdb_bulkdoc_appender/badges/gpa.svg)](https://codeclimate.com/github/jmarca/couchdb_bulkdoc_appender)
[![Test Coverage](https://codeclimate.com/github/jmarca/couchdb_bulkdoc_appender/badges/coverage.svg)](https://codeclimate.com/github/jmarca/couchdb_bulkdoc_appender/coverage) [![Build Status](https://travis-ci.org/jmarca/couchdb_bulkdoc_appender.svg?branch=master)](https://travis-ci.org/jmarca/couchdb_bulkdoc_appender)

This is a utility to help out saving docs to couchdb when those docs
might be updating existing docs.

very similar to my couchdb_bulkdoc_saver, except that existing fields
in a doc that are not in the "updating" doc are preserved, as I will
describe below.

Basically, the need I have is that I have a state document that stores
lots of things, and I want to update lots of these documents all at
once because I've updated how the geometry stuff  (added a few decimal
points to the geojson representation).  So I have lots of document
ids, and just one field from the existing documents to update.

Instead of one by one extracting and updating each document, I am
instead wanting to bulk get lots of docs, and then update all of them
with new information, and then bulk save the lot.

And create any new documents as needed.

Instead of making code inside my application to do this, I am creating
a small library with a test.


What is does it perform two calls to CouchDB.  The first is to
`all_docs?include_docs=true` which grabs the docs, the revision, and
the contents of each doc.

Each doc is visited, and if there isn't an existing doc, the passed in
doc will represent the entirety of that document in the db.  If there
*is* an existing document, then the passed in data is appended to the
existing doc, overwriting anything that already exists in the doc, but
everything else is copied as is from that existing document.

Then the second call to CouchDB is to bulk_docs, and the docs are
written.

The return value is passed to a callback you supply.  If no callback
is supplied, then you're on your own.

## usage

The program is a function generator.  You call it with an options
object, and an optional callback function.  The saver function is
either sent back as the return value, or else sent as the second
argument to the passed callback function.

The program expects that the url, port, username, password are in
the passed in options object.  For example

``` javascript
var make_bulkdoc_appender=require('couchdb_bulkdoc_appender')
var appender = make_bulkdoc_appender({
        "url": "http://127.0.0.1",
        "port":5984,
        "db": "a_test_data",
        "auth":{"username":"shebang",
                "password":"girls rule boys drool"
               })
```

## tests

I have a basic test that checks that this works.  It does.
