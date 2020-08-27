#ifndef INCLUDED_LINUX_CAMERA
#define INCLUDED_LINUX_CAMERA


class Camera
{
public:
	void record(FrameSink& sink);
	void stop();
};

#endif
