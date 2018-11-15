
interface ILogParser {
	public var info:TravisLogInfo;
	public function parse(log:String):Array<TestCaseInfo>;
}

typedef TravisLogInfo = {
	@:optional var haxeVersion:String;
	@:optional var owner:String;
	@:optional var repo:String;
	@:optional var branch:String;
}