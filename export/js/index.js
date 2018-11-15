;
$(document).ready(function(){
"use strict";

console.log("ready");

const TRAVIS_API = "https://api.travis-ci.org/v3/";
const TRAVIS_URL = "https://travis-ci.org/";
const GITHUB_URL = "https://github.com/";
const TEST_BUILD_ID = 454856167;
const TEST_JOB_ID = 454856168;

const $log = $('#log');
const $info = $('#info');
const $search = $('#search');
const $tree = $('#tree');
const $chart = $('#chart');

let testCases = null;
let apiUrl = "";
let travisUrl = "";
let travisInfo = { };

main();

function getUrlParameters() {
  let search = window.location.search.substring(1);
  if (search == "") return {};
  let params = search.split('&');

  let urlParams = {};
  
  for (let i = 0; i < params.length; i++) {
    let keyValue = params[i].split('=');

    urlParams[keyValue[0]] = keyValue[1] === undefined ? true : decodeURIComponent(keyValue[1]);
  }
  
  return urlParams;
}

function handleError(e) {
  console.error(e);
  $log.html(e);
}

function updateInfoOnPage() {
  let ownerRepoBranch = [travisInfo.repo, travisInfo.branch].join("/");
  let commitUrl = GITHUB_URL + travisInfo.repo + "/" + travisInfo.commit.sha;
  $info.find("#repo").attr("href", GITHUB_URL + ownerRepoBranch).text(ownerRepoBranch).attr("title", "github repo branch");
  $info.find("#commit").attr("href", commitUrl).text('"' + travisInfo.commit.message + '"').attr("title", "sha: " + travisInfo.commit.sha.substr(0, 8) + "…");
  $info.find("#travis").attr("href", travisUrl).attr("title", "travis-ci logs");//.text(travisUrl); 
}

function extractTravisInfo(json) {
  let travisInfo = { };
  travisInfo.repo = json.repository.slug;
  travisInfo.branch = json.commit.ref.split("/").pop();
  travisInfo.commit = {
    sha: json.commit.sha,
    message: json.commit.message
  };
  console.log(travisInfo);
  
  return travisInfo;
}

function fetchJson(url) {
  console.log("request: " + url);
  return fetch(url)
  .then(response => {
    if (!response.ok) handleError(response.statusText);
    else return response.json();
  })
  .catch(err => handleError(err));
}

function fetchLogForJob(jobId) {
  return fetchJson(TRAVIS_API + "job/" + jobId + "/log")
  .then(data => { 
    console.log("--- raw log for job/" + jobId);
    console.log(data.content.substr(0, 256) + "...");
    return data.content; 
  });
}

function addSearchFeature($tree, $input) {
  function search(e) {
    let pattern = $input.val();
    
    let results = $tree.treeview('search', [ pattern, {
      ignoreCase: true,     // case insensitive
      //exactMatch: false,    // like or equals
      revealResults: true,  // reveal matching nodes
    }]);
    
    var output = "[" + pattern + "] " + results.length + ' matches found';
    console.log(output);
  }

  $input.on('keyup', search);
}

function traverse(nodes, callback) {
  if (!nodes) return;

  for (let id in nodes) {
    let node = nodes[id];
    callback(node, id)
    if (node.nodes && node.nodes.length > 0) {
      traverse(node.nodes, callback);
    }
  };
}

function createNode(text, options) {
  if (options === undefined) options = { };
  return Object.assign({
    text: text,
    nodes: []
  }, options);
}

function bindTreeEvents() {
  $tree.on('nodeSelected', onNodeSelected);
  $("#search-expand").on('click', () => $tree.treeview('expandAll', { silent: true }));
  $("#search-collapse").on('click', () => $tree.treeview('collapseAll', { silent: true }));
  $("#search-reset").on('click', () => $tree.treeview('clearSearch', { silent: true }));
}

function createTree(el, treeData) {
  let options = {
    bootstrap2: false, 
    showTags: true,
    levels: 1,
    //enableLinks: true,
    searchResultColor: '#eee',
    expandIcon: "glyphicon glyphicon-chevron-right",
    collapseIcon: "glyphicon glyphicon-chevron-down",
    data: treeData
  };
  
  let treeview = $(el).treeview(options);
  
  return treeview;
}

function collectTreeData(testCases) {
  //testCases = testCases.splice(0, 10); // test a small sample
  let testcaseClass = "fas fa-suitcase";
  let nodes = [];
  let benchs = { };
  let suites = { };
  
  testCases.map(t => {
    if (benchs[t.benchName] === undefined) {
      let node = createNode(t.benchName);
      benchs[t.benchName] = node;
      nodes.push(node);
    }
  });
  testCases.map(t => {
    if (suites[t.suiteName] === undefined) {
      let node = createNode(t.suiteName);
      suites[t.suiteName] = node;
      benchs[t.benchName].nodes.push(node);
    }
  });
  
  let idx = 0;
  testCases.map(t => {
    let node = createNode(t.caseName, {arrayIdx: idx++, icon: testcaseClass});
    node.nodes = undefined;
    suites[t.suiteName].nodes.push(node);
  });
  
  // fix some props
  traverse(nodes, (node, id) => {
    let numChildren = node.nodes ? node.nodes.length : 0;
    node.selectable = numChildren == 0;
    node.tags = [numChildren > 0 ? '' + numChildren : ''];
  });
  
  testCases = testCases;
  
  console.log("nodes: ", nodes);
  
  return nodes;
}

function onNodeSelected(evt, data) {
  console.log("selected: ", data);
  $("#chart").html(evt, data);
}


// main entry point
function main() {
  
  let urlParams = getUrlParameters();
  console.log("url params: ", urlParams);


  let travisParams = {
    buildId: false,
    jobId: false
  };

  let parser = new TravisLogParser();
  let testCases = [];
  let treeData = [];

  if (!(urlParams["build"] || urlParams["job"] || urlParams["latest"])) {
    travisParams.jobId = TEST_JOB_ID;
    //travisParams.buildId = TEST_BUILD_ID;
  }

  //return;
  
  if (travisParams.buildId) {
    apiUrl = TRAVIS_API + "build/" + travisParams.buildId;
    travisUrl = TRAVIS_URL + "builds/" + travisParams.buildId;
  } else if (travisParams.jobId) {
    apiUrl = TRAVIS_API + "job/" + travisParams.jobId;
    travisUrl = TRAVIS_URL + "jobs/" + travisParams.jobId;
  }
  
  fetchJson(apiUrl)
  .then(json => {
    travisInfo = extractTravisInfo(json);
    updateInfoOnPage();
    
    let promises = [];
    if (travisInfo.build) {
      for (let job of json.jobs.splice(0, 1)) {
        console.log("job " + job);
        let promise = fetchLogForJob(job.id);
        promises.push(promise);
      }
    } else {
      let promise = fetchLogForJob(travisParams.jobId);
      promises.push(promise);
    }
    
    Promise.all(promises).then(rawLogs => {
      console.log("parsing " + rawLogs.length + " logs");
      for (let rawLog of rawLogs) {
        testCases = testCases.concat(parser.parse(rawLog));
      }
      $info.find("#haxe").text(parser.info.haxeVersion); 
      console.log("testCases: " + testCases.length);
      treeData = collectTreeData(testCases);
      createTree($tree, treeData);
      addSearchFeature($tree, $search);
      bindTreeEvents();
    });
  });
}

});

