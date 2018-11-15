
@:expose
@:native("hxutils")
class Utils {

	static public function contains(s:String, substr:String):Bool {
		return s.indexOf(substr) >= 0;
	}

	static public function toFixed(f:Float, decimals:Int = 2):Float {
		var exp = Math.pow(10, decimals);
		return (Math.round(f * exp) / exp);
	}

	static public function toMetric(value:Float, decimals:Int = 2):String {
		var divisors = [1000, 1000000, 1000000000];
		if (value < divisors[0]) return Std.string(toFixed(value, decimals));

		var suffixes = ['K', 'M', 'G'];
		var idx = 0;
		while (idx < divisors.length && value >= divisors[idx]) idx++;

		return "" + toFixed(value / divisors[idx-1], decimals) + suffixes[idx-1];
	}

#if js
	static public function download(filename:String, text:String):Void {
		var document = js.Browser.document;
		var element = document.createElement('a');
		element.setAttribute('href', 'data:text/plain;charset=utf-8,' + StringTools.urlEncode(text));
		element.setAttribute('download', filename);

		element.style.display = 'none';
		document.body.appendChild(element);

		element.click();

		document.body.removeChild(element);
	}
#end

	static public function matchBetween(str:String, startRegexp:EReg, endRegexp:EReg):BetweenMatch {
		var res:BetweenMatch = { matched: false };
		if (startRegexp.match(str)) {
			var start = startRegexp.matchedPos();
			res.start = {
				index: start.pos,
				length: start.len
			};
			var rightOfStart = start.pos + start.len;
			if (endRegexp.match(str.substr(rightOfStart))) {
				var end = endRegexp.matchedPos();
				res.end = {
					index: rightOfStart + end.pos,
					length: end.len
				};
				res.matchedString = str.substring(rightOfStart, res.end.index);
				res.matched = true;
			}
		}

		return res;
	}
}


typedef MatchPos = {
  var index:Int;
  var length:Int;
}

typedef BetweenMatch = {
  var matched:Bool;
  @:optional var start:MatchPos;
  @:optional var matchedString:String;
  @:optional var end:MatchPos;
}