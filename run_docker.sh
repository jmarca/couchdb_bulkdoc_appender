#!/bin/bash

# bash wrappers for docker run commands
# should work on linux, perhaps on OSX


#
# Environment vars
#


# # useful for connecting GUI to container
# SOCK=/tmp/.X11-unix
# XAUTH=/tmp/.docker.xauth
# xauth nlist $DISPLAY | sed -e 's/^..../ffff/' | xauth -f $XAUTH nmerge -
# chmod 755 $XAUTH

#
# Helper Functions
#
dcleanup(){
	local containers
	mapfile -t containers < <(docker ps -aq 2>/dev/null)
	docker rm "${containers[@]}" 2>/dev/null
	local volumes
	mapfile -t volumes < <(docker ps --filter status=exited -q 2>/dev/null)
	docker rm -v "${volumes[@]}" 2>/dev/null
	local images
	mapfile -t images < <(docker images --filter dangling=true -q 2>/dev/null)
	docker rmi "${images[@]}" 2>/dev/null
}
del_stopped(){
	local name=$1
	local state
	state=$(docker inspect --format "{{.State.Running}}" "$name" 2>/dev/null)

	if [[ "$state" == "false" ]]; then
		docker rm "$name"
	fi
}
relies_on(){
	for container in "$@"; do
		local state
		state=$(docker inspect --format "{{.State.Running}}" "$container" 2>/dev/null)

		if [[ "$state" == "false" ]] || [[ "$state" == "" ]]; then
			echo "$container is not running, starting it for you."
			$container
		fi
	done
}

relies_on_network(){
    for network in "$@"; do
        local state
        state=$(docker network inspect --format "{{.Created}}" "$network" 2>/dev/null)

        if [[ "$state" == "false" ]] || [[ "$state" == "" ]]; then
            echo "$network is not up, starting it for you."
            $network
        fi
    done
}

couchdb(){
    del_stopped "couchdb"
    relies_on_network couchdb_nw
    # fire up couchdb
    docker run -d \
           -e COUCHDB_USER=james \
           -e COUCHDB_PASSWORD=grobblefruit \
           --network=couchdb_nw \
           --name couchdb \
           couchdb:latest
}

couchdb_nw(){
    # create the network for communicating
    docker network create --driver bridge couchdb_nw
}


couch_setup_testdb(){
    COUCHDB_USER=james COUCHDB_PASSWORD=grobblefruit \
                curl  -H "Content-Type: application/json" -X PUT http://james:grobblefruit@localhost:5984/newdb
    # load dummy data into test db
    COUCHDB_USER=james COUCHDB_PASSWORD=grobblefruit \
                curl -d @test/bulkdocs.json -H "Content-Type: application/json" -X POST http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@localhost:5984/newdb/_bulk_docs
    COUCHDB_USER=james COUCHDB_PASSWORD=grobblefruit \
                curl -d @test/designdocs.json -H "Content-Type: application/json" -X POST http://${COUCHDB_USER}:${COUCHDB_PASSWORD}@localhost:5984/newdb/_bulk_docs
    COUCHDB_USER=james COUCHDB_PASSWORD=grobblefruit \
                echo "{\"couchdb\":{\"host\":\"couchdb\",\"port\":5984,\"db\":\"newdb\",\"auth\":{\"username\":\"${COUCHDB_USER}\",\"password\":\"${COUCHDB_PASSWORD}\"}}}" > test.config.json && chmod 0600 test.config.json
}

make_couch_node_tests_docker(){
    docker build  -t jmarca/couch_node_tests .
}


couch_node_test(){
    del_stopped "couch_node_tests"
    relies_on_network couchdb_nw
    relies_on couchdb
    docker run --rm -it \
           -u node \
           -v ${PWD}:/usr/src/dev \
           -w /usr/src/dev \
           --network=couchdb_nw \
           -e COUCHDB_USER=james \
           -e COUCHDB_PASSWORD=grobblefruit \
           -e COUCHDB_PASS=grobblefruit \
           -e COUCHDB_HOST=couchdb \
           --name run_tests_sh jmarca/couch_node_tests:126 bash

}
