import ILogParser;

using StringTools;


// almost copy-pasted from https://github.com/kevinresol/haxe_benchmark/blob/gh-pages/src/LogParser.hx

@:expose
@:native("TinkTravisLogParser")
//this is insane, don't try this at home
class TinkTravisLogParser implements ILogParser {

	static var CHECKOUT_FOLD_START_REGEXP = ~/^travis_fold:start:git.checkout/gm;
	static var CHECKOUT_FOLD_END_REGEXP = ~/^travis_fold:end:git.checkout/gm;
	static var BRANCH_OWNER_REPO_REGEXP = ~/^[\s\S]+git clone[\s\S]+--branch=([^\s]+)\s[\s\S]+.git ([^\/]+)\/([^s]+)/gm;
	static var ANSI_COLORING_REGEXP = ~/\x1B\[\d*m/g;

	static inline var START = '>> Haxe Benchmark Log Start <<';
	static inline var END = '>> Haxe Benchmark Log End <<';
	static inline var BUILD_FOLD = 'travis_fold:start:build-';
	static var REGEX_FORMAT = ~/\x1B\[\d*m/g;
	static var REGEX_SECTION = ~/^\x1B\[33m(\w*)\x1B\[39m$/;
	static var REGEX_TITLE = ~/ \[.*\] /g;
	static var REGEX_RESULT = ~/Benchmark: (\d*) iterations = ([\d\.]*) ms/g;

	public var name:String = "TinkTravisLogParser";
	public var info:TravisLogInfo;

	public function new() {}

	public function parse(log:String):Array<TestCaseInfo> {

		info = {
			haxeVersion: "",
			owner: "",
			repo: "",
			branch: "",
		};

		var results = [];
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

		var targets = new Map();
		var target = null;
		var started = false;
		var current:Array<Result> = [];
		var section = null;
		var haxeVer = null;

		var i = 0;
		for (i in 0...lines.length) {
			var line = lines[i];

			if (info.haxeVersion == "" && line.startsWith('$ export HAXE_VERSION=')) {
				info.haxeVersion = line.substr('$ export HAXE_VERSION='.length);
			}

			if (line == END) {
				started = false;
				targets[target] = current;
				current = [];
			}

			if (started) {
				if (REGEX_SECTION.match(line)) {
					section = REGEX_SECTION.matched(1);
				} else {
					var sanitized = REGEX_FORMAT.replace(line, '');
					// trace(sanitized);
					if (REGEX_RESULT.match(sanitized)) {
						var iterations = Std.parseInt(REGEX_RESULT.matched(1));
						var time = Std.parseFloat(REGEX_RESULT.matched(2));
						var perSecond = iterations / (time / 1000);
						var title = REGEX_TITLE.replace(REGEX_FORMAT.replace(lines[i - 1], ''), '').trim();
						current.push({section: section, title: title, iterations: iterations, time: time, perSecond: perSecond});
					}
				}
			}

			if (line.startsWith(BUILD_FOLD)) {
				target = line.substring(BUILD_FOLD.length, line.indexOf('.'));
				if (target.indexOf('interp') >= 0) target = 'eval';
			}

			if (line == START)
				started = true;
		}

		function tryConvertingToTargetType(s:String):String {
			return {
				if (s.startsWith("node")) TargetType.NODEJS;
				else if (s.startsWith("php")) TargetType.PHP;
				else s;
			}
		}

		for (k in targets.keys()) {
			for (result in targets[k]) {
				var caseInfo:TestCaseInfo = {
					target: tryConvertingToTargetType(k),
					benchName: "Benchmarks",
					suiteName: result.section,
					caseName: result.title,
					numSamples: Math.round(result.perSecond) // NOTE: rounding here!
				};
				results.push(caseInfo);
			}
		}

		return results;
	}
}

typedef Result = {
	final section:String;
	final title:String;
	final iterations:Int;
	final time:Float;
	final perSecond:Float;
}