#ifndef INCLUDED_CAMERA
#define INCLUDED_CAMERA

#include <cstdint>


struct FrameSource
{
	virtual void produce(std::uint32_t* data) = 0;

protected:
	FrameSource() = default;
	FrameSource(const FrameSource&) = default;
	FrameSource(FrameSource&&) = default;
	FrameSource& operator =(const FrameSource&) = default;
	FrameSource& operator =(FrameSource&&) = default;
	~FrameSource() = default;
};

struct FrameSink
{
	virtual void consume(int width, int height, FrameSource& source) = 0;

protected:
	FrameSink() = default;
	FrameSink(const FrameSink&) = default;
	FrameSink(FrameSink&&) = default;
	FrameSink& operator =(const FrameSink&) = default;
	FrameSink& operator =(FrameSink&&) = default;
	~FrameSink() = default;
};


#ifdef _WIN32
#include "win32/camera.h"
#else
#include "linux/camera.h"
#endif

#endif
