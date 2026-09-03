# processing/zone_segmenter.py

class ZoneSegmenter:

    @staticmethod
    def segment_lcr(l_channel):
        height, width = l_channel.shape

        left = l_channel[:, :width // 3]
        center = l_channel[:, width // 3: 2 * width // 3]
        right = l_channel[:, 2 * width // 3:]

        return left, center, right