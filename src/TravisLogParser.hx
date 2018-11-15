import ILogParser;

using StringTools;


// this is a regex-based parser, it will break! (:
@:expose
@:native("TravisLogParser")
class TravisLogParser implements ILogParser {

	public var info:TravisLogInfo;

	public function new() {}

	public function parse(log:String):Array<TestCaseInfo> {

		function toNumber(str:String):Int {
			return Std.parseInt(str.split(",").join(""));
		}

		info = {
			haxeVersion: "",
			owner: "",
			repo: "",
			branch: "",
		};

		var results = [];

		var CHECKOUT_FOLD_START_REGEXP = ~/^travis_fold:start:git.checkout/gm;
		var CHECKOUT_FOLD_END_REGEXP = ~/^travis_fold:end:git.checkout/gm;
		var BRANCH_OWNER_REPO_REGEXP = ~/^[\s\S]+git clone[\s\S]+--branch=([^\s]+)\s[\s\S]+.git ([^\/]+)\/([^s]+)/gm;
		var HAXE_VERSION_CMD_REGEXP = ~/haxe -version$/gm;

		var BENCH_FOLD_START_REGEXP = ~/^travis_fold:start:bench-([\s\S]+)/gm;
		var BENCH_FOLD_END_REGEXP = ~/^travis_fold:end:bench-([\s\S]+)/gm;
		var BENCH_NAME_REGEXP = ~/^Case: ([\s\S]+)/gm;
		var SUITE_NAME_REGEXP = ~/^\s+Suite: ([\s\S]+)/gm;
		var TESTCASE_REGEXP = ~/^\s+((?:[^:]+:)+)\s+((?:\d+,?)+)/gm;
		var ANSI_COLORING_REGEXP = ~/\x1B\[\d*m/g;

		var foundHaxeVersionCmd = false;
		var insideBenchFold = false;
		var target:TargetType = null;
		var benchName = null;
		var suiteName = null;
		var caseName = null;
		var numSamples:Null<Int> = null;

		var lines = [];

		var match = Utils.matchBetween(log, CHECKOUT_FOLD_START_REGEXP, CHECKOUT_FOLD_END_REGEXP);
		if (match.matched) {
			lines = ~/\r?\n/g.split(match.matchedString);
			for (line in lines) {
				line = ANSI_COLORING_REGEXP.replace(line, '');
				if (BRANCH_OWNER_REPO_REGEXP.match(line)) {
					info.owner = BRANCH_OWNER_REPO_REGEXP.matched(2);
					info.repo = BRANCH_OWNER_REPO_REGEXP.matched(3);
					info.branch = BRANCH_OWNER_REPO_REGEXP.matched(1);
				}
			}
		}

		lines = ~/\r?\n/g.split(log);

		for (line in lines) {
			line = ANSI_COLORING_REGEXP.replace(line, '');

			if (!foundHaxeVersionCmd && info.haxeVersion == "") {
				if (HAXE_VERSION_CMD_REGEXP.match(line)) {
					foundHaxeVersionCmd = true;
					continue;
				}
			}
			if (foundHaxeVersionCmd) {
				info.haxeVersion = line;
				foundHaxeVersionCmd = false;
			}

			if (!insideBenchFold && BENCH_FOLD_START_REGEXP.match(line)) {
				target = BENCH_FOLD_START_REGEXP.matched(1).trim();
				insideBenchFold = true;
			} else if (insideBenchFold) {
				if (BENCH_FOLD_END_REGEXP.match(line)) {
					var endTarget = BENCH_FOLD_END_REGEXP.matched(1).trim();
					if (endTarget != target) throw "LogParser error: Invalid bench-fold closing (expected: " + target + " vs actual: " + endTarget + ")";
					insideBenchFold = false;
					target = null;
					benchName = suiteName = caseName = null;
				} else {
					if (BENCH_NAME_REGEXP.match(line)) {
						benchName = BENCH_NAME_REGEXP.matched(1).trim();
						suiteName = caseName = null;
					}
					else if (SUITE_NAME_REGEXP.match(line)) {
						suiteName = SUITE_NAME_REGEXP.matched(1).trim();
					}
					else if (TESTCASE_REGEXP.match(line)) {
						caseName = TESTCASE_REGEXP.matched(1).trim().substr(0, -1);
						numSamples = toNumber(TESTCASE_REGEXP.matched(2).trim());

						var caseInfo:TestCaseInfo = {
							target: target,
							benchName: benchName,
							suiteName: suiteName,
							caseName: caseName,
							numSamples: numSamples
						};

						if (target == null || benchName == null || suiteName == null || caseName == null || numSamples == null) {
							throw "LogParser error: Invalid testcase #" + results.length + " (" + caseInfo + ")";
						}
						results.push(caseInfo);
					}
				}
			}
		}

		if (insideBenchFold) throw "LogParser error: Bench-fold for " + target + " never closed";

		return results;
	}
}
