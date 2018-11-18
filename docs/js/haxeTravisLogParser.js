// Generated by Haxe 4.0.0-preview.5
(function ($hx_exports) { "use strict";
function $extend(from, fields) {
	var proto = Object.create(from);
	for (var name in fields) proto[name] = fields[name];
	if( fields.toString !== Object.prototype.toString ) proto.toString = fields.toString;
	return proto;
}var EReg = function(r,opt) {
	this.r = new RegExp(r,opt.split("u").join(""));
};
EReg.__name__ = true;
EReg.prototype = {
	match: function(s) {
		if(this.r.global) {
			this.r.lastIndex = 0;
		}
		this.r.m = this.r.exec(s);
		this.r.s = s;
		return this.r.m != null;
	}
	,matched: function(n) {
		if(this.r.m != null && n >= 0 && n < this.r.m.length) {
			return this.r.m[n];
		} else {
			throw new js__$Boot_HaxeError("EReg::matched");
		}
	}
	,matchedPos: function() {
		if(this.r.m == null) {
			throw new js__$Boot_HaxeError("No string matched");
		}
		return { pos : this.r.m.index, len : this.r.m[0].length};
	}
	,split: function(s) {
		var d = "#__delim__#";
		return s.replace(this.r,d).split(d);
	}
};
var ILogParser = function() { };
ILogParser.__name__ = true;
var HaxeTravisLogParser = $hx_exports["HaxeTravisLogParser"] = function() {
	this.name = "HaxeTravisLogParser";
};
HaxeTravisLogParser.__name__ = true;
HaxeTravisLogParser.__interfaces__ = [ILogParser];
HaxeTravisLogParser.prototype = {
	parse: function(log) {
		var toNumber = function(str) {
			return Std.parseInt(str.split(",").join(""));
		};
		this.info = { haxeVersion : "", owner : "", repo : "", branch : ""};
		var results = [];
		var foundHaxeVersionCmd = false;
		var insideBenchFold = false;
		var target = null;
		var benchName = null;
		var suiteName = null;
		var caseName = null;
		var numSamples = null;
		var lines = [];
		var match = hxutils.matchBetween(log,HaxeTravisLogParser.CHECKOUT_FOLD_START_REGEXP,HaxeTravisLogParser.CHECKOUT_FOLD_END_REGEXP);
		if(match.matched) {
			lines = new EReg("\r?\n","g").split(match.matchedString);
			var _g = 0;
			while(_g < lines.length) {
				var line = lines[_g];
				++_g;
				line = line.replace(HaxeTravisLogParser.ANSI_COLORING_REGEXP.r,"");
				if(HaxeTravisLogParser.BRANCH_OWNER_REPO_REGEXP.match(line)) {
					this.info.owner = HaxeTravisLogParser.BRANCH_OWNER_REPO_REGEXP.matched(2);
					this.info.repo = HaxeTravisLogParser.BRANCH_OWNER_REPO_REGEXP.matched(3);
					this.info.branch = HaxeTravisLogParser.BRANCH_OWNER_REPO_REGEXP.matched(1);
				}
			}
		}
		lines = new EReg("\r?\n","g").split(log);
		var _g1 = 0;
		while(_g1 < lines.length) {
			var line1 = lines[_g1];
			++_g1;
			line1 = line1.replace(HaxeTravisLogParser.ANSI_COLORING_REGEXP.r,"");
			if(!foundHaxeVersionCmd && this.info.haxeVersion == "") {
				if(HaxeTravisLogParser.HAXE_VERSION_CMD_REGEXP.match(line1)) {
					foundHaxeVersionCmd = true;
					continue;
				}
			}
			if(foundHaxeVersionCmd) {
				this.info.haxeVersion = line1;
				foundHaxeVersionCmd = false;
			}
			if(!insideBenchFold && HaxeTravisLogParser.BENCH_FOLD_START_REGEXP.match(line1)) {
				target = TargetType.fromString(StringTools.trim(HaxeTravisLogParser.BENCH_FOLD_START_REGEXP.matched(1)));
				insideBenchFold = true;
			} else if(insideBenchFold) {
				if(HaxeTravisLogParser.BENCH_FOLD_END_REGEXP.match(line1)) {
					var endTarget = StringTools.trim(HaxeTravisLogParser.BENCH_FOLD_END_REGEXP.matched(1));
					if(TargetType.fromString(endTarget) != target) {
						throw new js__$Boot_HaxeError("LogParser error: Invalid bench-fold closing (expected: " + target + " vs actual: " + endTarget + ")");
					}
					insideBenchFold = false;
					target = null;
					caseName = null;
					suiteName = caseName;
					benchName = suiteName;
				} else if(HaxeTravisLogParser.BENCH_NAME_REGEXP.match(line1)) {
					benchName = StringTools.trim(HaxeTravisLogParser.BENCH_NAME_REGEXP.matched(1));
					caseName = null;
					suiteName = caseName;
				} else if(HaxeTravisLogParser.SUITE_NAME_REGEXP.match(line1)) {
					suiteName = StringTools.trim(HaxeTravisLogParser.SUITE_NAME_REGEXP.matched(1));
				} else if(HaxeTravisLogParser.TESTCASE_REGEXP.match(line1)) {
					caseName = HxOverrides.substr(StringTools.trim(HaxeTravisLogParser.TESTCASE_REGEXP.matched(1)),0,-1);
					numSamples = toNumber(StringTools.trim(HaxeTravisLogParser.TESTCASE_REGEXP.matched(2)));
					var caseInfo = { target : target, benchName : benchName, suiteName : suiteName, caseName : caseName, numSamples : numSamples};
					if(target == null || benchName == null || suiteName == null || caseName == null || numSamples == null) {
						throw new js__$Boot_HaxeError("LogParser error: Invalid testcase #" + results.length + " (" + Std.string(caseInfo) + ")");
					}
					results.push(caseInfo);
				}
			}
		}
		if(insideBenchFold) {
			throw new js__$Boot_HaxeError("LogParser error: Bench-fold for " + target + " never closed");
		}
		return results;
	}
};
var HxOverrides = function() { };
HxOverrides.__name__ = true;
HxOverrides.cca = function(s,index) {
	var x = s.charCodeAt(index);
	if(x != x) {
		return undefined;
	}
	return x;
};
HxOverrides.substr = function(s,pos,len) {
	if(len == null) {
		len = s.length;
	} else if(len < 0) {
		if(pos == 0) {
			len = s.length + len;
		} else {
			return "";
		}
	}
	return s.substr(pos,len);
};
Math.__name__ = true;
var Std = function() { };
Std.__name__ = true;
Std.string = function(s) {
	return js_Boot.__string_rec(s,"");
};
Std.parseInt = function(x) {
	var v = parseInt(x, x && x[0]=="0" && (x[1]=="x" || x[1]=="X") ? 16 : 10);
	if(isNaN(v)) {
		return null;
	}
	return v;
};
var StringTools = function() { };
StringTools.__name__ = true;
StringTools.isSpace = function(s,pos) {
	var c = HxOverrides.cca(s,pos);
	if(!(c > 8 && c < 14)) {
		return c == 32;
	} else {
		return true;
	}
};
StringTools.ltrim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,r)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s,r,l - r);
	} else {
		return s;
	}
};
StringTools.rtrim = function(s) {
	var l = s.length;
	var r = 0;
	while(r < l && StringTools.isSpace(s,l - r - 1)) ++r;
	if(r > 0) {
		return HxOverrides.substr(s,0,l - r);
	} else {
		return s;
	}
};
StringTools.trim = function(s) {
	return StringTools.ltrim(StringTools.rtrim(s));
};
var TargetType = $hx_exports["TargetType"] = {};
TargetType.__name__ = true;
TargetType.fromString = function(s) {
	if(s == null || TargetType.allValues.indexOf(s) >= 0) {
		return s;
	} else {
		throw new js__$Boot_HaxeError("Invalid TargetType: \"" + s + "\" (should be one of " + Std.string(TargetType.allValues.map(function(v) {
			return "\"" + v + "\"";
		})) + ")");
	}
};
var hxutils = $hx_exports["hxutils"] = function() { };
hxutils.__name__ = true;
hxutils.contains = function(s,substr) {
	return s.indexOf(substr) >= 0;
};
hxutils.toFixed = function(f,decimals) {
	if(decimals == null) {
		decimals = 2;
	}
	var exp = Math.pow(10,decimals);
	return Math.round(f * exp) / exp;
};
hxutils.toMetric = function(value,decimals) {
	if(decimals == null) {
		decimals = 2;
	}
	var divisors = [1000,1000000,1000000000];
	if(value < divisors[0]) {
		return Std.string(hxutils.toFixed(value,decimals));
	}
	var suffixes = ["K","M","G"];
	var idx = 0;
	while(idx < divisors.length && value >= divisors[idx]) ++idx;
	return "" + hxutils.toFixed(value / divisors[idx - 1],decimals) + suffixes[idx - 1];
};
hxutils.download = function(filename,text) {
	var document = window.document;
	var element = document.createElement("a");
	element.setAttribute("href","data:text/plain;charset=utf-8," + encodeURIComponent(text));
	element.setAttribute("download",filename);
	element.style.display = "none";
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
};
hxutils.matchBetween = function(str,startRegexp,endRegexp) {
	var res = { matched : false};
	if(startRegexp.match(str)) {
		var start = startRegexp.matchedPos();
		res.start = { index : start.pos, length : start.len};
		var rightOfStart = start.pos + start.len;
		if(endRegexp.match(HxOverrides.substr(str,rightOfStart,null))) {
			var end = endRegexp.matchedPos();
			res.end = { index : rightOfStart + end.pos, length : end.len};
			res.matchedString = str.substring(rightOfStart,res.end.index);
			res.matched = true;
		}
	}
	return res;
};
var js__$Boot_HaxeError = function(val) {
	Error.call(this);
	this.val = val;
	if(Error.captureStackTrace) {
		Error.captureStackTrace(this,js__$Boot_HaxeError);
	}
};
js__$Boot_HaxeError.__name__ = true;
js__$Boot_HaxeError.__super__ = Error;
js__$Boot_HaxeError.prototype = $extend(Error.prototype,{
});
var js_Boot = function() { };
js_Boot.__name__ = true;
js_Boot.__string_rec = function(o,s) {
	if(o == null) {
		return "null";
	}
	if(s.length >= 5) {
		return "<...>";
	}
	var t = typeof(o);
	if(t == "function" && (o.__name__ || o.__ename__)) {
		t = "object";
	}
	switch(t) {
	case "function":
		return "<function>";
	case "object":
		if(o.__enum__) {
			var e = $hxEnums[o.__enum__];
			var n = e.__constructs__[o._hx_index];
			var con = e[n];
			if(con.__params__) {
				s += "\t";
				var tmp = n + "(";
				var _g = [];
				var _g1 = 0;
				var _g2 = con.__params__;
				while(_g1 < _g2.length) {
					var p = _g2[_g1];
					++_g1;
					_g.push(js_Boot.__string_rec(o[p],s));
				}
				return tmp + _g.join(",") + ")";
			} else {
				return n;
			}
		}
		if((o instanceof Array)) {
			var l = o.length;
			var i;
			var str = "[";
			s += "\t";
			var _g3 = 0;
			var _g11 = l;
			while(_g3 < _g11) {
				var i1 = _g3++;
				str += (i1 > 0 ? "," : "") + js_Boot.__string_rec(o[i1],s);
			}
			str += "]";
			return str;
		}
		var tostr;
		try {
			tostr = o.toString;
		} catch( e1 ) {
			var e2 = (e1 instanceof js__$Boot_HaxeError) ? e1.val : e1;
			return "???";
		}
		if(tostr != null && tostr != Object.toString && typeof(tostr) == "function") {
			var s2 = o.toString();
			if(s2 != "[object Object]") {
				return s2;
			}
		}
		var k = null;
		var str1 = "{\n";
		s += "\t";
		var hasp = o.hasOwnProperty != null;
		for( var k in o ) {
		if(hasp && !o.hasOwnProperty(k)) {
			continue;
		}
		if(k == "prototype" || k == "__class__" || k == "__super__" || k == "__interfaces__" || k == "__properties__") {
			continue;
		}
		if(str1.length != 2) {
			str1 += ", \n";
		}
		str1 += s + k + " : " + js_Boot.__string_rec(o[k],s);
		}
		s = s.substring(1);
		str1 += "\n" + s + "}";
		return str1;
	case "string":
		return o;
	default:
		return String(o);
	}
};
var macro_Macro = function() { };
macro_Macro.__name__ = true;
String.__name__ = true;
Array.__name__ = true;
Object.defineProperty(js__$Boot_HaxeError.prototype,"message",{ get : function() {
	return String(this.val);
}});
HaxeTravisLogParser.CHECKOUT_FOLD_START_REGEXP = new EReg("^travis_fold:start:git.checkout","gm");
HaxeTravisLogParser.CHECKOUT_FOLD_END_REGEXP = new EReg("^travis_fold:end:git.checkout","gm");
HaxeTravisLogParser.BRANCH_OWNER_REPO_REGEXP = new EReg("^[\\s\\S]+git clone[\\s\\S]+--branch=([^\\s]+)\\s[\\s\\S]+.git ([^/]+)/([^s]+)","gm");
HaxeTravisLogParser.ANSI_COLORING_REGEXP = new EReg("\\x1B\\[\\d*m","g");
HaxeTravisLogParser.HAXE_VERSION_CMD_REGEXP = new EReg("haxe -version$","gm");
HaxeTravisLogParser.BENCH_FOLD_START_REGEXP = new EReg("^travis_fold:start:bench-([\\s\\S]+)","gm");
HaxeTravisLogParser.BENCH_FOLD_END_REGEXP = new EReg("^travis_fold:end:bench-([\\s\\S]+)","gm");
HaxeTravisLogParser.BENCH_NAME_REGEXP = new EReg("^Case: ([\\s\\S]+)","gm");
HaxeTravisLogParser.SUITE_NAME_REGEXP = new EReg("^\\s+Suite: ([\\s\\S]+)","gm");
HaxeTravisLogParser.TESTCASE_REGEXP = new EReg("^\\s+((?:[^:]+:)+)\\s+((?:\\d+,?)+)","gm");
TargetType.EVAL = "eval";
TargetType.MACRO = "macro";
TargetType.FLASH = "flash";
TargetType.NODEJS = "nodejs";
TargetType.JS = "js";
TargetType.CPP = "cpp";
TargetType.NEKO = "neko";
TargetType.HL = "hl";
TargetType.CS = "cs";
TargetType.JAVA = "java";
TargetType.PYTHON = "python";
TargetType.PHP = "php";
TargetType.LUA = "lua";
TargetType.UNKNOWN = "unknown";
TargetType.allValues = ["eval","macro","flash","nodejs","js","cpp","neko","hl","cs","java","python","php","lua","unknown"];
})(typeof exports != "undefined" ? exports : typeof window != "undefined" ? window : typeof self != "undefined" ? self : this);
