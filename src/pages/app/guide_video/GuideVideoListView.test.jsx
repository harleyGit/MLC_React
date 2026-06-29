import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import guideVideoItem from "../../assets/guide_video_item.png";
import GuideVideoListView from "./GuideVideoListView";

const defaultUserAgent = window.navigator.userAgent;

beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: jest.fn(),
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: jest.fn().mockResolvedValue(undefined),
  });
});

beforeEach(() => {
  window.HTMLMediaElement.prototype.pause.mockClear();
  window.HTMLMediaElement.prototype.play.mockClear();
  setUserAgent(defaultUserAgent);
  delete window.webkit;
  delete window.imiycc;
});

afterEach(() => {
  window.HTMLMediaElement.prototype.play.mockResolvedValue(undefined);
});

const openFirstVideo = () => {
  fireEvent.click(screen.getAllByRole("img")[0]);
};

const setUserAgent = (userAgent) => {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
};

test("renders native ad placeholder in video list", () => {
  render(<GuideVideoListView />);

  expect(document.getElementById("nativeAd")).toBeInTheDocument();
});

test("posts native ad position after list renders in iOS WKWebView", async () => {
  const postMessage = jest.fn();
  Object.defineProperty(window, "webkit", {
    configurable: true,
    value: {
      messageHandlers: {
        adPosition: { postMessage },
      },
    },
  });

  render(<GuideVideoListView />);

  await waitFor(() => expect(postMessage).toHaveBeenCalled());
  expect(postMessage.mock.calls[0][0]).toEqual(
    expect.objectContaining({
      elementId: "nativeAd",
    })
  );
  expect(typeof postMessage.mock.calls[0][0].y).toBe("number");
});

test("posts native ad position after list renders in Android WebView", async () => {
  const adPosition = jest.fn();
  Object.defineProperty(window, "imiycc", {
    configurable: true,
    value: {
      adPosition,
    },
  });

  render(<GuideVideoListView />);

  await waitFor(() => expect(adPosition).toHaveBeenCalled());
  expect(JSON.parse(adPosition.mock.calls[0][0])).toEqual(
    expect.objectContaining({
      elementId: "nativeAd",
    })
  );
  expect(typeof JSON.parse(adPosition.mock.calls[0][0]).y).toBe("number");
});

test("updates native ad placeholder height from native callback", async () => {
  render(<GuideVideoListView />);

  act(() => {
    window.nativeCallback("nativeAdHeight", { height: 90 });
  });

  await waitFor(() => {
    expect(document.getElementById("nativeAd")).toHaveStyle({ height: "90px" });
  });
});

test("renders player overlay above list without native ad after opening video", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const player = document.querySelector(".video-player-overlay");

  expect(document.querySelector(".guide-container")).toContainElement(player);
  expect(document.querySelector(".video-list")).toBeInTheDocument();
  expect(document.getElementById("nativeAd")).not.toBeInTheDocument();
});

test("covers underlying list with blurred black player overlay", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const player = document.querySelector(".video-player-overlay");
  const background = document.querySelector(".player-page-background");

  expect(background).toContainElement(document.querySelector(".video-list"));
  expect(player).toHaveClass("blurred-player-overlay");
});

test("opens player page without fullscreen after clicking video item", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(document.querySelector(".video-player-overlay")).not.toHaveClass("fullscreen");
});

test("does not start playback after clicking video item", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
});

test("starts playback after tapping custom play button", async () => {
  render(<GuideVideoListView />);

  openFirstVideo();
  fireEvent.click(document.querySelector(".controls button"));

  await waitFor(() => {
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});

test("removes cover and unmutes video before Android custom play call", async () => {
  render(<GuideVideoListView />);

  openFirstVideo();
  const video = document.querySelector("video");
  video.muted = true;

  fireEvent.click(document.querySelector(".controls button:first-child"));

  await waitFor(() => {
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
  expect(video.muted).toBe(false);
  expect(document.querySelector(".video-player-cover")).not.toBeInTheDocument();
});

test("does not set video poster to avoid Android WebView keeping placeholder", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(document.querySelector("video")).not.toHaveAttribute("poster");
});

test("keeps placeholder cover inside video stage before playback", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const stage = document.querySelector(".video-stage");
  const video = document.querySelector("video");
  const cover = document.querySelector(".video-player-cover");

  expect(stage).toContainElement(video);
  expect(stage).toContainElement(cover);
});

test("uses stable video stage box so Android cover overlays video area", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(document.querySelector(".video-stage")).toHaveClass("video-stage-ready");
});

test("keeps close button outside video stage controls", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(document.querySelector(".video-stage")).not.toContainElement(
    document.querySelector(".close-button")
  );
  expect(document.querySelector(".controls")).not.toContainElement(
    document.querySelector(".close-button")
  );
  expect(document.querySelector(".video-player-overlay")).toContainElement(
    document.querySelector(".close-button")
  );
});

test("renders visible Android player page without blurred overlay", () => {
  setUserAgent("Mozilla/5.0 (Linux; Android 13; WebView)");

  render(<GuideVideoListView />);

  openFirstVideo();

  const playerPage = document.querySelector(".player-page");
  const player = document.querySelector(".video-player-overlay");

  expect(playerPage).toHaveClass("android-player-page");
  expect(document.querySelector(".player-page-background")).not.toBeInTheDocument();
  expect(player).toHaveClass("android-visible-player");
  expect(player.querySelector(".controls button:first-child")).toBeInTheDocument();
});

test("shows Android cover before playback without attaching video source", () => {
  setUserAgent("Mozilla/5.0 (Linux; Android 13; WebView)");

  render(<GuideVideoListView />);

  openFirstVideo();

  const cover = document.querySelector(".video-player-cover");
  const video = document.querySelector("video");

  expect(cover).toBeInTheDocument();
  expect(cover).toHaveAttribute("src", guideVideoItem);
  expect(video).not.toHaveAttribute("src");
});

test("hides Android cover only after tapping it to play", async () => {
  setUserAgent("Mozilla/5.0 (Linux; Android 13; WebView)");

  render(<GuideVideoListView />);

  openFirstVideo();
  expect(document.querySelector(".video-player-cover")).toBeInTheDocument();

  fireEvent.click(document.querySelector(".video-player-cover"));

  await waitFor(() => {
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
  expect(document.querySelector(".video-player-cover")).not.toBeInTheDocument();
  expect(document.querySelector("video")).toHaveAttribute(
    "src",
    expect.stringContaining("guide_bind.mp4")
  );
});

test("restores cover when custom play is rejected", async () => {
  const consoleErrorSpy = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  window.HTMLMediaElement.prototype.play.mockRejectedValueOnce(
    new Error("Android WebView blocked play")
  );
  render(<GuideVideoListView />);

  openFirstVideo();
  fireEvent.click(document.querySelector(".controls button:first-child"));

  await waitFor(() => {
    expect(document.querySelector(".video-player-cover")).toBeInTheDocument();
  });
  consoleErrorSpy.mockRestore();
});

test("returns to list after playing then tapping top-left close button", async () => {
  render(<GuideVideoListView />);

  openFirstVideo();
  fireEvent.click(document.querySelector(".controls button:first-child"));
  await waitFor(() => {
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  fireEvent.click(document.querySelector(".close-button"));

  expect(document.querySelector(".video-player-overlay")).not.toBeInTheDocument();
  expect(document.getElementById("nativeAd")).toBeInTheDocument();
});

test("uses top-left close button style for exiting player page", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(document.querySelector(".close-button")).toHaveTextContent("×");
});

test("uses svg fullscreen icon instead of system font glyph", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const fullscreenButton = document.querySelector(".fullscreen-button");

  expect(fullscreenButton).toBeInTheDocument();
  expect(fullscreenButton).not.toHaveTextContent("⛶");
  expect(fullscreenButton.querySelector(".fullscreen-icon")).toBeInTheDocument();
});

test("uses svg play icon instead of system font glyph", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const playButton = document.querySelector(".play-toggle-button");

  expect(playButton).toBeInTheDocument();
  expect(playButton).not.toHaveTextContent("▶");
  expect(playButton.querySelector(".play-toggle-icon")).toBeInTheDocument();
});

test("uses svg fullscreen exit icon instead of system font glyph", () => {
  render(<GuideVideoListView />);

  openFirstVideo();
  fireEvent.click(document.querySelector(".fullscreen-button"));

  const exitButton = document.querySelector(".exit-fullscreen-btn");

  expect(exitButton).toBeInTheDocument();
  expect(exitButton).not.toHaveTextContent("⤢");
  expect(exitButton.querySelector(".exit-fullscreen-icon")).toBeInTheDocument();
  expect(exitButton.querySelector(".exit-fullscreen-icon path")).toHaveAttribute(
    "d",
    "M7 3v4H3M13 3v4h4M17 13h-4v4M3 13h4v4"
  );
});

test("centers original player page without native video controls", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const player = document.querySelector(".video-player-overlay");
  const video = player.querySelector("video");

  expect(player.querySelector(".controls")).toBeInTheDocument();
  expect(video).not.toHaveAttribute("controls");
});

test("reports native ad hidden after opening player", async () => {
  const postMessage = jest.fn();
  Object.defineProperty(window, "webkit", {
    configurable: true,
    value: {
      messageHandlers: {
        adPosition: { postMessage },
      },
    },
  });

  render(<GuideVideoListView />);
  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

  openFirstVideo();

  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
  expect(postMessage.mock.calls[1][0]).toEqual(
    expect.objectContaining({
      elementId: "nativeAd",
      visible: false,
    })
  );
  expect(postMessage.mock.calls[1][0].y).toBeGreaterThanOrEqual(
    document.body.scrollHeight
  );
});

test("keeps custom controls in player page", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  const player = document.querySelector(".video-player-overlay");
  const video = player.querySelector("video");

  expect(player.querySelector(".controls")).toBeInTheDocument();
  expect(video).not.toHaveAttribute("controls");
});

test("does not disable native video tap target before fullscreen", () => {
  render(<GuideVideoListView />);

  openFirstVideo();

  expect(document.querySelector(".video-player")).not.toHaveClass(
    "custom-controlled"
  );
});

test("keeps fullscreen exit button after pausing with custom button", async () => {
  render(<GuideVideoListView />);

  openFirstVideo();
  fireEvent.click(document.querySelector(".controls button:last-child"));
  fireEvent.click(document.querySelector(".controls button:first-child"));
  await waitFor(() => {
    expect(document.querySelector(".play-toggle-button")).toHaveAttribute(
      "aria-label",
      "暂停播放"
    );
  });

  fireEvent.click(document.querySelector(".play-toggle-button"));

  expect(document.querySelector(".exit-fullscreen-btn")).toBeInTheDocument();
});

test("returns to list after tapping fullscreen exit button", async () => {
  render(<GuideVideoListView />);

  openFirstVideo();
  fireEvent.click(document.querySelector(".controls button:last-child"));
  fireEvent.click(document.querySelector(".exit-fullscreen-btn"));

  expect(document.querySelector(".video-player-overlay")).not.toBeInTheDocument();
  expect(document.getElementById("nativeAd")).toBeInTheDocument();
});

test("reports native ad position again after opening player", async () => {
  const postMessage = jest.fn();
  Object.defineProperty(window, "webkit", {
    configurable: true,
    value: {
      messageHandlers: {
        adPosition: { postMessage },
      },
    },
  });

  render(<GuideVideoListView />);
  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

  openFirstVideo();

  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
});

test("reports native ad visible again after closing player", async () => {
  const postMessage = jest.fn();
  Object.defineProperty(window, "webkit", {
    configurable: true,
    value: {
      messageHandlers: {
        adPosition: { postMessage },
      },
    },
  });

  render(<GuideVideoListView />);
  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

  openFirstVideo();
  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));

  fireEvent.click(document.querySelector(".close-button"));

  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(3));
  expect(postMessage.mock.calls[2][0]).toEqual(
    expect.objectContaining({
      elementId: "nativeAd",
      visible: true,
    })
  );
});

test("ignores repeated native ad height callbacks with same height", async () => {
  const postMessage = jest.fn();
  Object.defineProperty(window, "webkit", {
    configurable: true,
    value: {
      messageHandlers: {
        adPosition: { postMessage },
      },
    },
  });

  render(<GuideVideoListView />);
  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(1));

  act(() => {
    window.nativeCallback("nativeAdHeight", { height: 90 });
  });
  await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));

  act(() => {
    window.nativeCallback("nativeAdHeight", { height: 90 });
  });
  expect(postMessage).toHaveBeenCalledTimes(2);
});
