#ifndef INCLUDED_TRACKER
#define INCLUDED_TRACKER

#include <cstdint>
#include <memory>

#include "image.h"
#include "frame_queue.h"
#include "camera.h"



struct TrackingCallback
{
	virtual void detected() = 0;
	virtual void tracking_lost() = 0;

protected:
	TrackingCallback() = default;
	TrackingCallback(const TrackingCallback&) = default;
	TrackingCallback(TrackingCallback&&) = default;
	TrackingCallback& operator =(const TrackingCallback&) = default;
	TrackingCallback& operator =(TrackingCallback&&) = default;
	~TrackingCallback() = default;
};

class Tracker : public virtual FrameSink
{
	struct frame_data
	{
		std::unique_ptr<std::uint32_t[]> data;
		int width;
		int height;
	};

	FrameQueue<frame_data> frame_queue;

	unsigned long long num_frames = 0;

	image<float> mean;
	image<float> weight;
	image<float> variance;
	image<char> num_modes;
	int width = 0;
	int height = 0;

	FrameSink* sink = nullptr;

	void consume(int width, int height, FrameSource& frame_source) override;

	void resize(int width, int height);
	void update(frame_data& frame);

public:
	explicit Tracker(FrameSink* sink = nullptr);
};

#endif
