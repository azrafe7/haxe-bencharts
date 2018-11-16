;$(document).ready(function() {
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

let testCases = [];
let treeData = [];
let apiEndPoint = "";
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

// https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript/3561711#3561711
function regexpEscape(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function handleError(e) {
  console.error(e);
  $log.html(e);
}

function updateInfoOnPage(endPoint) {
  let regexp = /^(build|job)([\s\S]*)/gmi;
  if (!regexp.test(endPoint)) throw "Endpoint '" + endPoint + "' doesn't match regexp";
  endPoint = endPoint.replace(regexp, "$1s$2");
  travisUrl = TRAVIS_URL + travisInfo.repo + "/" + endPoint;
  let commitUrl = GITHUB_URL + travisInfo.repo + "/commit/" + travisInfo.commit.sha;
  $info.find("#repo").attr("href", GITHUB_URL + travisInfo.repo + "/tree/" + travisInfo.branch).text(travisInfo.repo + "/" + travisInfo.branch).attr("title", "github repo branch");
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

function debounce(func, delay) {
  let timeoutId;
  
  return function() {
    let context = this;
    let args = arguments;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(context, args), delay);
  }
}

function addSearchFeature($tree, $input) {
  let oldPattern = null;
  const delay = 250;
  
  function searchWrapper(e) {
    
    if (e.keyCode == 13) return; // enter
    //if (e.keyCode == 38 || e.keyCode == 40) $input.blur(); // blur on up/down
    if (e.keyCode == 27 || $input.val() == "") { // esc
      $input.val("");
      $tree.treeview('collapseAll', { silent: true });
    }
    
    return function search(e) {
      let pattern = $input.val();
      
      let results = [];
      
      if (pattern != oldPattern) {
        results = $tree.treeview('search', [ regexpEscape(pattern), {
          ignoreCase: true,     // case insensitive
          //exactMatch: false,    // like or equals
          revealResults: true,  // reveal matching nodes
          includeLineage: true,
        }]);

        //if (results.length > 0) {
        //  $tree.find("li:not(.search-result)").hide();
        //}
        
        var output = "[" + pattern + "] " + results.length + ' matches found';
        console.log(output);
    
        oldPattern = pattern;
      }
    }(e);
  }
  
  $input.on('keyup', debounce(searchWrapper, delay));
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
    searchResultColor: '#337AB8', //1565c0
    selectedColor: '#FFFFFF',
    expandIcon: "glyphicon glyphicon-chevron-right",
    collapseIcon: "glyphicon glyphicon-chevron-down",
    data: treeData
  };
  
  let treeview = $(el).treeview(options);
  
  return treeview;
}

function collectTreeData(testCases) {
  //testCases = testCases.splice(0, 10); // test a small sample
  let testCaseClass = "fas fa-suitcase";
  let nodes = [];
  let benchs = { };
  let suites = { };
  
  let idx = 0;
  testCases.map(t => {
    if (benchs[t.benchName] === undefined) {
      let node = createNode(t.benchName);
      benchs[t.benchName] = node;
      nodes.push(node);
    }
    let bench = benchs[t.benchName];
    let suiteId = t.benchName + t.suiteName;
    if (suites[suiteId] === undefined) {
      let node = createNode(t.suiteName);
      suites[suiteId] = node;
      bench.nodes.push(node);
    }
    let suite = suites[suiteId];
    let node = createNode(t.caseName, {arrayIdx: idx++, icon: testCaseClass});
    node.nodes = undefined;
    suite.nodes.push(node);
  });
  
  // add some props
  traverse(nodes, (node, id) => {
    let numChildren = node.nodes ? node.nodes.length : 0;
    node.selectable = numChildren == 0;
    node.tags = [numChildren > 0 ? '' + numChildren : ''];
  });

  console.log("nodes: ", nodes);
  
  return nodes;
}

function onNodeSelected(evt, data) {
  console.log("selected: ", data);
  $("#chart").html("<pre><code>" + JSON.stringify(data, null, 2) + "</code></pre>");
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

  if (!(urlParams["build"] || urlParams["job"])) {
    travisParams.jobId = TEST_JOB_ID;
    //travisParams.buildId = TEST_BUILD_ID;
  }

  //return;
  
  if (travisParams.buildId) apiEndPoint = "build/" + travisParams.buildId;
  else if (travisParams.jobId) apiEndPoint = "job/" + travisParams.jobId;
  else {
    handleError("No end-point!");
    throw "No end-point!";
  }
  
  fetchJson(TRAVIS_API + apiEndPoint)
  .then(json => {
    travisInfo = extractTravisInfo(json);
    updateInfoOnPage(apiEndPoint);
    
    let promises = [];
    if (travisParams.buildId) {
      for (let job of json.jobs.splice(0, 1)) { // should be splice 3 for haxe tests!
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
      $search.focus();
    });
  });
}

});

