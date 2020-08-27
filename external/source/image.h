#ifndef INCLUDED_IMAGE
#define INCLUDED_IMAGE

#include <cstddef>
#include <algorithm>
#include <memory>


template <typename T>
class image
{
	std::unique_ptr<T[]> buffer;
	std::size_t width;
	std::size_t height;

	static constexpr std::size_t buffer_size(std::size_t width, std::size_t height) noexcept
	{
		return width * height;
	}

	static std::unique_ptr<T[]> alloc(std::size_t width, std::size_t height)
	{
		return std::unique_ptr<T[]>(new T[buffer_size(width, height)]);
	}

	constexpr std::size_t index(std::size_t x, std::size_t y) noexcept
	{
		return y * width + x;
	}

public:
	image() = default;

	image(std::size_t width, std::size_t height)
		: buffer(alloc(width, height)),
		  width(width),
		  height(height)
	{
	}

	image(const image&) = delete;
	image(image&&) = default;

	image& operator =(const image&) = delete;
	image& operator =(image&&) = default;

	const T& operator ()(std::size_t x, std::size_t y) const noexcept { return buffer[index(x, y)]; }
	T& operator ()(std::size_t x, std::size_t y) noexcept { return buffer[index(x, y)]; }

	const T* begin() const noexcept { return &buffer[0]; }
	T* begin() noexcept { return &buffer[0]; }
	const T* cbegin() const noexcept { return begin(); }

	const T* end() const noexcept { return begin() + buffer_size(width, height); }
	T* end() noexcept { return begin() + buffer_size(width, height); }
	const T* cend() const noexcept { return end(); }
};

#endif
