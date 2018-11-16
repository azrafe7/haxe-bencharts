@:expose
@:native("TargetType")
@:enum abstract TargetType(String) to String {
	var EVAL = "eval";
	var MACRO = "macro";
	var FLASH = "flash";
	var NODEJS = "nodejs";
	var JS = "js";
	var CPP = "cpp";
	var NEKO = "neko";
	var HL = "hl";
	var CS = "cs";
	var JAVA = "java";
	var PYTHON = "python";
	var PHP = "php";
	var LUA = "lua";
	var UNKNOWN = "unknown";

	static public var allValues:Array<String> = macro.Macro.getAbstractEnumValues(TargetType);

	@:from static public function fromString(s:String):TargetType {
		if (s == null || allValues.indexOf(s) >= 0) return cast s;
		else throw "Invalid TargetType: '" + s + "'";
	}
}
