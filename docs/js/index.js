;$(document).ready(function() {
"use strict";

console.log("ready");

const TRAVIS_API = "https://api.travis-ci.org/v3/";
const TRAVIS_URL = "https://travis-ci.org/";
const GITHUB_URL = "https://github.com/";
const TEST_BUILD_ID = 456815836; // 456755801
const TEST_JOB_ID = 456815838; // 456755803
const TEST_TINK_JOB_ID = 434644243; // https://travis-ci.org/kevinresol/haxe_benchmark/jobs/434644243
const TEST_REPO = "azrfe7/hxOrderedMap"; // latest build from this repo (fetched via https://api.travis-ci.org/v3/azrafe7%2FhxOrderedMap/builds?limit=1)

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
let travisInfo = { };   // collected info about owner/repo/branch, commit/pr, etc.
let consoleMessageQueue = [];
let selectedNode = null;

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

function log(msg) {
  $log.html(msg);
}

function handleError(e) {
  console.error(e);
  log(e);
}

function updateInfoOnPage(endPoint) {
  let regexp = /^(build|job)([\s\S]*)/gmi;
  if (!regexp.test(endPoint)) throw "Endpoint '" + endPoint + "' doesn't match regexp";
  endPoint = endPoint.replace(regexp, "$1s$2");
  travisUrl = TRAVIS_URL + travisInfo.repo + "/" + endPoint;
  
  $info.find("#repo").attr("href", GITHUB_URL + travisInfo.repo + "/tree/" + travisInfo.branch).text(travisInfo.repo + "/" + travisInfo.branch).attr("title", "github repo");
  
  let commitUrl = GITHUB_URL + travisInfo.repo + "/commit/" + travisInfo.commit.sha;
  let pullUrl = GITHUB_URL + travisInfo.repo + "/" + travisInfo.pull.url;
  if (travisInfo.pull.title) {
    let $pullAnchor = $("<a>").attr({href: pullUrl, target: "_blank", title: "pull request: " + travisInfo.pull.url.split('/').pop()}).text(travisInfo.pull.url);
    $info.find("#code-ref").html('"' + travisInfo.pull.title + '" (').append($pullAnchor).append(")");
  } else {
    let $shaAnchor = $("<a>").attr({href: commitUrl, target: "_blank", title: "commit: " + travisInfo.commit.sha}).text(travisInfo.commit.sha.substr(0, 8));
    $info.find("#code-ref").html('"' + travisInfo.commit.message + '" (').append($shaAnchor).append(")");
  }
  
  let $travisAnchor = $("<a>").attr({href: travisUrl, target: "_blank", title: "travis-ci logs"}).text(endPoint.substr(endPoint.lastIndexOf('/') + 1));
  $info.find("#travis").append(endPoint.lastIndexOf('jobs') >= 0 ? ' job (' : ' build (').append($travisAnchor).append(")"); 
}

function extractTravisInfo(buildJson, json) {
  let travisInfo = { };
  if (!json.repository && buildJson.repository) json = buildJson;
  travisInfo.repo = json.repository.slug;
  travisInfo.branch = buildJson.branch ? buildJson.branch.name : "";
  travisInfo.commit = {
    sha: json.commit.sha,
    message: json.commit.message
  };
  travisInfo.pull = {
    title: buildJson.pull_request_title || "",
    url: buildJson.pull_request_number != null ? "pull/" + buildJson.pull_request_number : ""
  };
  console.log("travisInfo:", travisInfo);
  
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
      if (selectedNode) $tree.treeview('revealNode', [ selectedNode, { silent: true } ]);
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
  $tree.on('click', '.open-suite-chart', (evt) => {
    let nodeId = $(evt.target).closest('li.list-group-item').attr('data-nodeid');
    let node = $tree.treeview('getNode', +nodeId);
    console.log('open chart suite:', node);
    plotChart(node.nodes[0], false);
    evt.stopPropagation();
  });
  $tree.on('nodeSelected', onNodeSelected);
  $tree.on('nodeUnselected', onNodeUnselected);
  $("#search-expand").on('click', () => $tree.treeview('expandAll', { silent: true }));
  $("#search-collapse").on('click', () => $tree.treeview('collapseAll', { silent: true }));
  $("#search-reset").on('click', () => $tree.treeview('clearSearch', { silent: true }));
}

function closeDataView() { // returns false if no dataview is open
  let $dataViewCloseBtn = $("#chart > div:nth-child(3) > div:nth-child(3) > div");
  let isOpen = $dataViewCloseBtn.length > 0;
  if (isOpen) $dataViewCloseBtn.trigger('click');
  return isOpen;
}

function bindKeyEvents() {
  function onKeyUp(e) {
    // close chart data view if open, else reset search and give it focus
    if (e.keyCode == 27) {
      if (!closeDataView()) {
        $search.val("").trigger('keyup').focus();
      }
    }
  }
  
  $(document).on('keyup', onKeyUp);
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
    expandIcon: "glyphicon glyphicon-chevron-right", // glyphicon-triangle-right
    collapseIcon: "glyphicon glyphicon-chevron-down", // glyphicon-triangle-bottom
    data: treeData
  };
  
  let treeview = $(el).treeview(options);
  
  return treeview;
}

/** Removes duplicate test cases (same target, benchName, suiteName, caseName) and returns a new filtered array (order is preserved)
    if keepLast is false then then the first encountered test will be kept, otherwise the last one
    
    python (f.e.) runs the same tests on both python3 and pypy. This ensures we only keep whichever comes first (or last)
 */
function filterOutDups(testCases, keepLast) {
  function createTestId(t) {
    return [t.target, t.benchName, t.suiteName, t.caseName].join('/');
  }
  
  let orderedTestIds = [];
  let testsById = { };

  testCases.forEach(t => {
    let id = createTestId(t);
    let idExists = testsById[id] !== undefined;
    if (!idExists) {
      orderedTestIds.push(id);
    }
    if (keepLast || (!keepLast && !idExists)) {
      testsById[id] = t;
    }
  });
  
  return orderedTestIds.map(id => testsById[id]);
}

function collectTreeData(testCases) {
  //testCases = testCases.splice(0, 10); // test a small sample
  let testCaseClass = ""; // "fas fa-suitcase";
  let nodes = [];
  let benchs = { };
  let suites = { };
  let cases = { };
  
  let idx = 0;
  testCases.forEach(t => {
    if (benchs[t.benchName] === undefined) {
      let node = createNode(t.benchName);
      benchs[t.benchName] = node;
      nodes.push(node);
    }
    let bench = benchs[t.benchName];
    let suiteId = t.benchName + t.suiteName;
    if (suites[suiteId] === undefined) {
      let node = createNode(t.suiteName, {isSuite:true});
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
    if (node.isSuite) {
      let chartSpan = '<span class="btn-link glyphicon glyphicon-stats open-suite-chart" title="plot all"></span>';
      node.floatRightHtml = chartSpan;
    }
  });

  console.log("nodes: ", nodes);
  
  return nodes;
}

function onNodeSelected(evt, data) {
  console.log("selected: ", data);
  selectedNode = data;
  //$("#chart").html("<pre><code>" + JSON.stringify(data, null, 2) + "</code></pre>");
  plotChart(data, true);
}

function onNodeUnselected(evt, data) {
  console.log("unselected: ", data);
  selectedNode = undefined;
}

function plotChart(nodeData, singleCase) {
  if (!echart) {
    echart = echarts.init($chart[0]);
    window.onresize = () => echart.resize();
  }
  closeDataView();
  
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
    let ok = t.benchName == nodeData.test.benchName && t.suiteName == nodeData.test.suiteName && (!singleCase || (singleCase && t.caseName == nodeData.test.caseName));
    if (ok) {
      if (!byTarget[t.target]) byTarget[t.target] = { };

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

  // converts data into html table representation (shown in dataview)
  function optionToContent(options) {
    let axisData = options.xAxis[0].data;
    let series = options.series;

    let heading = '<div id="dataview-heading"><div>' + options.title[0].text + '</div>'
                  + '<div class="small text-muted">' + options.title[0].subtext + '</div></div>';
    
    let thead = '<thead><tr>'
                + '<th>' + options.xAxis[0].name + '/' + options.yAxis[0].name + '</th>';
    for (let serie of series) {
      thead += '<th>' + serie.name + '</th>';
    }
    thead += '</tr></thead>';
    
    let tbody = '<tbody>';
    for (let i = 0, len = axisData.length; i < len; i++) {
      let caseName = axisData[i];
      tbody += '<tr><td>' + caseName + '</td>';
      for (let serie of series) {
        tbody += '<td>' + serie.data[i] + '</td>';
      }
      tbody += '</tr>';
    }
    tbody += '</tbody>';
    
    let table = '<table class="table small table-striped table-hover table-condensed" style="width:100%;font-family:monospace;">'
                + thead + tbody + '</table>';
                
    return heading + table;
  }
  
  let options = {
    title: {
      text: nodeData.test.benchName,
      itemGap: 5,
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
    toolbox: {
      show: true,
      orient: 'vertical',
      right: 38,
      top: 50,
      itemGap: 20,
      feature: {
        dataView: {
          show: true, 
          readOnly: true,
          optionToContent: optionToContent
        },
        magicType: {
          show: true, 
          type: ['stack', 'tiled'],
          title: { // override titles
            stack: "Stacked Bar Chart",
            tiled: "Bar Chart",
          },
          icon: {
            tiled: 'path://' + 'M6.7,22.9h10V48h-10V22.9zM24.9,13h10v35h-10V13zM43.2,2h10v46h-10V2zM3.1,58h53.7', // override tiled icon to look like the bar icon
          },
          option: {
            stack: {
              // TODO: show data labels inside the related bar portion insted of jumbled-on-top
            }
          }
        },
        saveAsImage: {show: true}
      }
    },
    //calculable: true,
    legend: {
      data: labelNames
    },
    xAxis: [
      {
        name: 'tests',
        //nameLocation: 'center',
        //nameGap: 50,
        nameTextStyle: {
          fontWeight: 'bold',
          fontSize: 14
        },
        type: 'category',
        axisTick: {show: false},
        axisLabel: {
          rotate: (singleCase || uniqueCaseNames.length <= 3) ? 0 : 90
        },
        data: uniqueCaseNames,
      }
    ],
    yAxis: [
      {
        name: 'ops',
        nameLocation: 'center',
        nameGap: 100,
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

  let parser; // this will be assigned the last parser used (in Promise.all().then())
  let parsers = [new HaxeTravisLogParser(), new TinkTravisLogParser()];

  travisParams.buildId = urlParams["build"];
  travisParams.jobId = urlParams["job"];
  travisParams.repo = urlParams["repo"];

  //return;
  
  if (!(travisParams.buildId || travisParams.jobId || travisParams.repo)) {
    //travisParams.jobId = TEST_JOB_ID;
    //travisParams.jobId = TEST_TINK_JOB_ID;
    //travisParams.repo = TEST_REPO;
    travisParams.buildId = TEST_BUILD_ID;
    log("No specific endPoint (using a test one - see console)");
    enqueueConsoleMessage("No specific endPoint (using a test one - see console)", "warn");
    enqueueConsoleMessage("Try '?build=<BUILD_ID>' or '?job=<JOB_ID>' or '?repo=<OWNER/REPO_NAME>'", "warn");
  } 
  
  if (travisParams.buildId) apiEndPoint = "build/" + travisParams.buildId;
  else if (travisParams.jobId) apiEndPoint = "job/" + travisParams.jobId;
  else if (travisParams.repo) apiEndPoint = "repo/" + encodeURIComponent(travisParams.repo) + "/builds?limit=1";
  
  fetchJson(TRAVIS_API + apiEndPoint)
  .then(json => {
    if (!travisParams.buildId) { // fetch the build json (so we can properly extract info)
      let buildId = json.build ? json.build.id : json.builds[0].id;
      return fetchJson(TRAVIS_API + "build/" + buildId)
             .then(buildJson => Promise.resolve([json, buildJson]));
    }
    else return Promise.resolve([json, json]);
  })
  .then(jsons => {
    let originalJson = jsons[0];
    let buildJson = jsons[1];
    travisInfo = extractTravisInfo(buildJson, originalJson);
    if (travisParams.repo) {
      apiEndPoint = "build/" + buildJson.id;
      originalJson.jobs = buildJson.jobs;
    }
    updateInfoOnPage(apiEndPoint);
    
    //return;
    
    // build up requests
    let promises = [];
    if (travisParams.buildId || travisParams.repo) {
      for (let i = 0, jobs = originalJson.jobs.splice(0, 3); i < jobs.length; i++) { // should be splice(0, 3) for haxe tests (0:neko, 1:all-but-cpp, 2:cpp)!
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
      for (parser of parsers) {
        console.log("try parsing " + rawLogs.length + " logs with " + parser.name);
        for (let rawLog of rawLogs) {
          testCases = testCases.concat(parser.parse(rawLog));
        }
        if (testCases.length > 0) break;
      }
      //hxutils.download("testcases.json", JSON.stringify(testCases));
      console.log("parserInfo: ", parser.info);
      log("Parsed " + testCases.length + " test cases");
      $info.find("#haxe").text(parser.info.haxeVersion); 
      console.log("testCases: " + testCases.length);
      let filteredTestCases = filterOutDups(testCases, false);
      console.log("duplicateTestCases: " + (testCases.length - filteredTestCases.length));
      testCases = filteredTestCases;
      treeData = collectTreeData(testCases);
      createTree($tree, treeData);
      addSearchFeature($tree, $search);
      bindTreeEvents();
      bindKeyEvents();
      
      $search.focus();
    })
    .catch(err => handleError(err))
    .then(() => flushConsoleMessageQueue());
  });
}

});

