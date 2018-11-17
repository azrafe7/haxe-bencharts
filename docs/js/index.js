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
let echart = null;

let testCases = [];     // test cases as parsed from the log
let treeData = [];      // test cases in tree form (passed to treeview)
let apiEndPoint = "";   // travis api endpoint
let travisUrl = "";     // link to travis logs
let travisInfo = { };   // collected info about owner/repo/branch and commit
let consoleMessageQueue = [];

const targetPill = '•'; // •❚●○⚪⚫⦿▐

const targetColors = { };
(function setupTargetColors() {
  targetColors[TargetType.CPP    ] = '#F34B7D';
  targetColors[TargetType.JS     ] = '#CC4125';
  targetColors[TargetType.NODEJS ] = '#CC4125';
  targetColors[TargetType.FLASH  ] = '#E01';
  targetColors[TargetType.CS     ] = '#178600';
  targetColors[TargetType.JAVA   ] = '#B07219';
  targetColors[TargetType.HL     ] = '#FF9900';
  targetColors[TargetType.NEKO   ] = '#A64D79';
  targetColors[TargetType.PYTHON ] = '#3572A5';
  targetColors[TargetType.EVAL   ] = '#342628';
  targetColors[TargetType.MACRO  ] = '#342628';
  targetColors[TargetType.LUA    ] = '#DCC';
  targetColors[TargetType.PHP    ] = '#1B52A5';
  targetColors[TargetType.UNKNOWN] = '#FFF';
})();

const displayOrder = [
  TargetType.CPP,
  TargetType.JS,
  TargetType.NODEJS,
  TargetType.CS,
  TargetType.JAVA,
  TargetType.FLASH,
  TargetType.HL,
  TargetType.NEKO,
  TargetType.EVAL,
  TargetType.MACRO,
  TargetType.PHP,
  TargetType.PYTHON,
  TargetType.LUA,
  TargetType.UNKNOWN
];

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
          //exactMatch: false,  // like or equals
          revealResults: true,  // reveal matching nodes
          includeLineage: true, // include parents and children of search results
        }]);
        
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
    showFloatRightHtml: true,
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
  let testCaseClass = ""; // "fas fa-suitcase";
  let nodes = [];
  let benchs = { };
  let suites = { };
  let cases = { };
  
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
    let caseId = t.benchName + t.suiteName + t.caseName;
    if (cases[caseId] === undefined) {
      let node = createNode(t.caseName, {icon: testCaseClass});
      cases[caseId] = node;
      suite.nodes.push(node);
      node.targets = [];
    }
    let caseNode = cases[caseId];
    
    // python (f.e.) runs the same tests on both python3 and pypy. This ensures we only keep whichever comes first from the parsed log.
    if (caseNode.targets.filter(targetObj => targetObj.name == t.target).length > 0) return;

    caseNode.test = t;
    caseNode.targets.push({name: t.target, index: idx++});
    caseNode.nodes = undefined;
  });
  
  // add some props
  traverse(nodes, (node, id) => {
    let numChildren = node.nodes ? node.nodes.length : 0;
    node.selectable = numChildren == 0;
    if (!node.tags) node.tags = [];
    node.tags.push(numChildren > 0 ? '' + numChildren : '');
    if (node.targets) {
      node.targets.sort((a, b) => displayOrder.indexOf(a.name) - displayOrder.indexOf(b.name));
      let spans = node.targets.map(target => {
        let bgColor;
        let fgColor = targetColors[target.name];
        let spanStyle = 'style="background-color:' + bgColor + '; color:' + fgColor + ';"';
        return '<span class="' + target.name + '" title="' + target.name + '" ' + spanStyle + '>' + targetPill + '</span>';
      });
      node.floatRightHtml = spans.join("");
    }
  });

  console.log("nodes: ", nodes);
  
  return nodes;
}

function onNodeSelected(evt, data) {
  console.log("selected: ", data);
  //$("#chart").html("<pre><code>" + JSON.stringify(data, null, 2) + "</code></pre>");
  plotChart(data);
}

function plotChart(nodeData) {
  let labelOptions = {
    normal: {
      show: true,
      position: 'top',
      distance: 10,
      align: 'left',
      verticalAlign: 'middle',
      rotate: 90,
      formatter: (params) => '{customLabelStyle|' + hxutils.toMetric(params.value) + '}',
      rich: {
        customLabelStyle: {
          fontSize: 10,
          //textBorderColor: '#fff',
          //textBorderWidth: 2
        }
      }
    }
  };
  
  let byTarget = { };
  let uniqueCaseNames = [];
  let tests = testCases.filter(t => {
    let ok = t.benchName == nodeData.test.benchName && t.suiteName == nodeData.test.suiteName;
    if (ok) {
      if (!byTarget[t.target]) byTarget[t.target] = { };
      
      // python (f.e.) runs the same tests on both python3 and pypy. This ensures we only keep whichever comes first from the parsed log.
      if (byTarget[t.target][t.caseName]) return;
      
      byTarget[t.target][t.caseName] = t;
      
      if (uniqueCaseNames.indexOf(t.caseName) < 0) uniqueCaseNames.push(t.caseName);
    }
    
    return ok;
  });
  
  let labelNames = [];
  let barColors = [];
  let series = [];
  let xAxisLabels = nodeData.name;
  let targetIdx = -1;
  for (let target of displayOrder) {
    if (byTarget[target]) {
      targetIdx++;
      labelNames.push(target);
      barColors.push(targetColors[target]);
      for (let caseName of uniqueCaseNames) {
        if (series.length <= targetIdx) series[targetIdx] = [];
        series[targetIdx].push(byTarget[target][caseName].numSamples);
      }
    }
  }
  
  let seriesOptions = [];
  for (let i = 0; i < series.length; i++) {
    let serie = series[i];
    seriesOptions.push({
      name: labelNames[i],
      type: 'bar',
      barGap: 0,
      label: labelOptions,
      data: serie
    });
  }

  let options = {
    title: {
      text: nodeData.test.benchName,
      subtext: nodeData.test.suiteName
    },
    grid: {
      containLabel: true
    },
    color: barColors,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    legend: {
      data: labelNames
    },
    xAxis: [
      {
        name: 'cases',
        nameLocation: 'center',
        nameGap: 50,
        nameTextStyle: {
          fontWeight: 'bold',
          fontSize: 14
        },
        type: 'category',
        axisTick: {show: false},
        axisLabel: {
          rotate: 90
        },
        data: uniqueCaseNames,
      }
    ],
    yAxis: [
      {
        name: 'numSamples',
        nameLocation: 'center',
        nameGap: 80,
        nameTextStyle: {
          fontWeight: 'bold',
          fontSize: 14
        },
        type: 'value'
      }
    ],
    series: seriesOptions
  };

  console.log("chart data:", options);
  
  echart.setOption(options, true);
}

function enqueueConsoleMessage(message, method) {
  consoleMessageQueue.push({text: message, method: method || "log"});
}

function flushConsoleMessageQueue() {
  let msg;
  while (msg = consoleMessageQueue.shift()) {
    console[msg.method].call(null, msg.text);
  }
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

  travisParams.buildId = urlParams["build"];
  travisParams.jobId = urlParams["job"];

  //return;
  
  if (!(travisParams.buildId || travisParams.jobId)) {
    //travisParams.jobId = TEST_JOB_ID;
    travisParams.buildId = TEST_BUILD_ID;
    handleError("No specific endPoint. Using a test one (see console).");
    enqueueConsoleMessage("No specific endPoint. Using a test one (see console).", "warn");
    enqueueConsoleMessage("Try '?build=<BUILD_ID>' or '?job=<JOB_ID>'", "warn");
  } 
  
  if (travisParams.buildId) apiEndPoint = "build/" + travisParams.buildId;
  else if (travisParams.jobId) apiEndPoint = "job/" + travisParams.jobId;
  
  fetchJson(TRAVIS_API + apiEndPoint)
  .then(json => {
    travisInfo = extractTravisInfo(json);
    updateInfoOnPage(apiEndPoint);
    
    // build up requests
    let promises = [];
    if (travisParams.buildId) {
      for (let i = 0, jobs = json.jobs.splice(1, 2); i < jobs.length; i++) { // should be splice(0, 3) for haxe tests (0:neko, 1:all-but-cpp, 2:cpp)!
        let job = jobs[i];
        console.log("job " + i);
        let promise = fetchLogForJob(job.id);
        promises.push(promise);
      }
    } else {
      let promise = fetchLogForJob(travisParams.jobId);
      promises.push(promise);
    }
    
    // act when all of them complete
    Promise.all(promises).then(rawLogs => {
      console.log("parsing " + rawLogs.length + " logs");
      for (let rawLog of rawLogs) {
        testCases = testCases.concat(parser.parse(rawLog));
      }
      //hxutils.download("testcases.json", JSON.stringify(testCases));
      $info.find("#haxe").text(parser.info.haxeVersion); 
      console.log("testCases: " + testCases.length);
      treeData = collectTreeData(testCases);
      createTree($tree, treeData);
      addSearchFeature($tree, $search);
      bindTreeEvents();
      
      $search.focus();
      echart = echarts.init($chart[0]);
      window.onresize = () => echart.resize();
    })
    .catch(err => handleError(err))
    .then(() => flushConsoleMessageQueue());
  });
}

});

