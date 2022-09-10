@import Cocoa;

static NSArray* windows;
static NSUInteger count;

#if __cplusplus
extern "C" {
#endif


__attribute__((visibility("default")))
int enumWindows()
{
	CGWindowListOption listOptions = kCGWindowListOptionAll;
	//listOptions |= kCGWindowListOptionOnScreenOnly;
	//listOptions |= kCGWindowListExcludeDesktopElements;

	// Ask the window server for the list of windows.
	windows = (NSArray*)CGWindowListCopyWindowInfo(listOptions, kCGNullWindowID);
	count = [windows count];

	return count;
}

__attribute__((visibility("default")))
const char* getTitle(i) {
	if(windows == NULL) {
		count	= enumWindows();
	}
	//for (NSUInteger i = 0; i < count; i++) {
	//}
	NSDictionary*   nswindowsdescription = [windows objectAtIndex:i];
	//NSNumber* windowid = (NSNumber*)[nswindowsdescription objectForKey:@"kCGWindowNumber"];
	NSString* windowName = (NSString*)[nswindowsdescription objectForKey:@"kCGWindowOwnerName"];
	NSNumber* windowLayer = (NSNumber*)[nswindowsdescription objectForKey:@"kCGWindowLayer"];
	NSString* res = [NSString stringWithFormat:@"%@: %s", windowLayer, [windowName UTF8String]];
	return (char *)[res UTF8String];
}

#if __cplusplus
}
#endif


int main(int argc, char *argv[])
{
    int count = enumWindows();
		for(int i = 0; i < count; i++) {
			printf("%s\n", getTitle(i));
		}
}
