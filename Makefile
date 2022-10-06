
#CLANG   = /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang
CLANG := clang

LINK    = /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/clang 

ARCH    = x86_64 -arch arm64 
MIN_VERSION = 10.8

DEBUG_PATH  = bin/debug

SYSROOT = $(wildcard /Applications/Xcode.app/Contests/Developer/Platforms/MacOSX.platform/Developer/SDKs/*/)

IBTOOL  = /Applications/Xcode.app/Contents/Developer/usr/bin/ibtool

SDK = $(wildcard /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX1*)

FRAME   = $(wildcard /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/*/System/Library/Frameworks)

LIB = $(wildcard /Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/*/usr/lib)

FLAGS   = -g -O0 -fmodules -x objective-c -fno-objc-arc

%.nib: %.xib
	$(IBTOOL) --errors --warnings --notices --output-format human-readable-text --compile $@ ./$< --sdk $(SDK)

%.o: %.m
	$(CLANG) -arch $(ARCH) $(FLAGS) -Wall -c $< -o $@


SOG_OBJS := \
						main.o 
#						Controller.o 
						

LDFLAGS := -arch $(ARCH) \
					 -framework Cocoa
#-isysroot $(SYSROOT) 
#-F $(FRAME)

sog.dylib: $(SOG_OBJS)
	$(CLANG) $(SOG_OBJS) $(LDFLAGS) -dynamiclib -rdynamic -o $@


sog: $(SOG_OBJS)
	$(CLANG) $(SOG_OBJS) $(LDFLAGS) -o $@

.DEFAULT_GOAL := sog

