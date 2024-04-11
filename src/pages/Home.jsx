import { Flex, VStack, Center } from "@chakra-ui/layout";
import { useCallback, useEffect, useState } from "react";
import {
  createPlaylist,
  getTracks,
  getNextTracks,
  getUser,
  deletePlaylist,
  addTracksToPlaylist,
  getPlaylists,
  searchForTracks,
} from "../utils/api.js";
import {
  Button,
  SimpleGrid,
  Container,
  useToast,
  useDisclosure,
  Box,
  Heading,
  Icon,
} from "@chakra-ui/react";
import PlaylistTable from "../components/Tables/PlaylistTable.jsx";
import SongTable from "../components/Tables/SongTable.jsx";
import { useGlobalState } from "../contexts/GlobalContext.jsx";
import CleanSongTable from "../components/Tables/CleanSongTable.jsx";
import { SummaryModal } from "../components/Modals/SummaryModal.jsx";
import useAuth from "../hooks/useAuth.jsx";
import SpotifyWebApi from "spotify-web-api-node";
import { ConflictModal } from "../components/Modals/Conflict/ConflictModal.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { CLIENT_ID } from "../utils/Constants.jsx";
import Header from "../components/Header.jsx";
import { ExplainModal } from "../components/Modals/ExplainModal.jsx";
import * as fuzzball from "fuzzball";

export const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
});

const Home = ({ code }) => {
  const [isLoading, setIsLoading] = useState(true);
  const accessToken = useAuth(code);
  const [user, setUser] = useState();
  const { setToken, setCheckedPlaylist, songsToResolve, setSongsToResolve } =
    useGlobalState();
  const [mixerStatus, setMixerStatus] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState(false);
  const [mixerProgress, setMixerProgress] = useState(false);
  const [gettingTracks, setGettingTracks] = useState(false);
  const [wantedExplicit, setWantedExplicit] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    spotifyApi.setAccessToken(accessToken);
    setToken(accessToken);
    localStorage.setItem("api-key", accessToken);
    setIsLoading(false);
  }, [accessToken, setToken]);

  const {
    isOpen: isSummaryOpen,
    onOpen: onSummaryOpen,
    onClose: onSummaryClose,
  } = useDisclosure();

  const {
    isOpen: isExplainOpen,
    onOpen: onExplainOpen,
    onClose: onExplainClose,
  } = useDisclosure();

  const {
    isOpen: isResolveOpen,
    onOpen: onResolveOpen,
    onClose: onResolveClose,
  } = useDisclosure();
  const [isMixerLoading, setisMixerLoading] = useState();

  const toast = useToast();

  const {
    checkedPlaylist,
    playlists,
    tracks,
    setPlaylists,
    setTracks,
    cleanedPlaylistID,
    setCleanedPlaylistID,
  } = useGlobalState();

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser(await getUser());
      } catch (e) {
        toast({
          title: `Unable to perform action. Please try refreshing the page and log in again`,
          position: "top",
          status: "error",
          duration: 7000,
          isClosable: true,
        });
      }
    };
    if (accessToken) {
      loadUser();
    }
  }, [accessToken, toast]);

  const handleDelete = async () => {
    setDeleteStatus(true);
    setCheckedPlaylist(
      String(Number(checkedPlaylist) - 1) >= 0
        ? String(Number(checkedPlaylist) - 1)
        : ""
    );

    await deletePlaylist(playlists.items[checkedPlaylist].id);
    const refreshedPlaylists = await getPlaylists();
    if (refreshedPlaylists instanceof Error) {
      toast({
        title: `Unable to perform action. Please try refreshing the page and log in again`,
        position: "top",
        status: "error",
        duration: 7000,
        isClosable: true,
      });

      return;
    }
    setPlaylists(refreshedPlaylists);
    setDeleteStatus(false);
  };

  const negate = (condition, shouldNegate) => {
    return shouldNegate ? condition : !condition;
  };

  const containSameArtists = (first, second) => {
    if (first.artists.length !== second.artists.length) return false;
    let artistCount = first.artists.length;
    for (let index = 0; index < artistCount; index++) {
      if (first.artists[index].name !== second.artists[index].name) {
        return false;
      }
    }
    return true;
  };

  const getAllTracks = useCallback(async () => {
    setGettingTracks(true);
    setTracks({ items: [] });

    const allTracks = [];
    let tracks = await getTracks(playlists.items[checkedPlaylist].id);
    if (tracks instanceof Error) {
      toast({
        title: `Unable to perform action. Please try refreshing the page and log in again`,
        position: "top",
        status: "error",
        duration: 7000,
        isClosable: true,
      });
      return;
    }
    if (!tracks) {
      toast({
        title: `Error fetching all tracks. Refresh and try again`,
        position: "top",
        status: "error",
        duration: 7000,
        isClosable: true,
      });
    }
    allTracks.push(...tracks.items);
    while (tracks && tracks.next) {
      tracks = await getNextTracks(tracks.next);
      if (!tracks) {
        toast({
          title: `Error fetching all tracks. Refresh and try again`,
          position: "top",
          status: "error",
          duration: 7000,
          isClosable: true,
        });
      }
      if (tracks && tracks.items) {
        allTracks.push(...tracks.items);
      }
    }
    tracks = { items: allTracks };

    setTracks(tracks);
    setGettingTracks(false);
    return allTracks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedPlaylist, setTracks, toast]);

  useEffect(() => {
    if (checkedPlaylist && checkedPlaylist >= 0) {
      getAllTracks();
    }
  }, [checkedPlaylist, getAllTracks]);

  const handleMixer = async (shouldExplicitify) => {
    try {
      setMixerStatus(true);
      setWantedExplicit(shouldExplicitify);

      const cleanTrackIDs = [];
      const explicitTracks = [];

      for (let t of tracks.items) {
        if (!t.track) continue;
        t && t.track && negate(t.track.explicit, shouldExplicitify)
          ? explicitTracks.push({
              query: `${t.track.name} ${t.track.artists[0].name}`,
              name: t.track.name,
              artists: t.track.artists,
              uri: t.track.uri,
              link: t.track.external_urls.spotify,
            })
          : cleanTrackIDs.push(t.track.uri);
      }

      const cleanVersionTrackIDs = [];
      const remainingExplicitSongs = [];
      const potentiallyCleanSongs = new Map();

      const total = explicitTracks.length;
      let index = 0;
      for (let track of explicitTracks) {
        index++;
        if (track.query.length === 0) continue;
        const trackResponses = await searchForTracks(
          track.query.trim().replaceAll("#", "")
        );
        if (!trackResponses) {
          toast({
            title: `Error searching for track. Refresh and try again`,
            position: "top",
            status: "error",
            duration: 7000,
            isClosable: true,
          });
        }
        if (trackResponses instanceof Error) {
          toast({
            title: `Error while converting. Your playlist may be too big. Refresh and try again`,
            position: "top",
            status: "error",
            duration: 7000,
            isClosable: true,
          });
          setMixerStatus(false);
          return;
        }
        let isClean = false;
        if (trackResponses && trackResponses.tracks.items.length > 0) {
          for (let t of trackResponses.tracks.items) {
            if (
              t &&
              t.name &&
              negate(!t.explicit, shouldExplicitify) &&
              containSameArtists(t, track)
            ) {
              if (fuzzball.distance(t.name, track.name) === 0) {
                cleanVersionTrackIDs.push(t.uri);
                isClean = true;
                break;
              } else if (fuzzball.ratio(t.name, track.name) > 1) {
                if (potentiallyCleanSongs.has(track.name)) {
                  potentiallyCleanSongs.get(track.name).push({
                    name: t.name,
                    link: t.external_urls.spotify,
                    uri: t.uri,
                    original_track_uri: track.uri,
                    original_track_link: track.link,
                  });
                } else {
                  potentiallyCleanSongs.set(track.name, [
                    {
                      name: t.name,
                      link: t.external_urls.spotify,
                      uri: t.uri,
                      original_track_uri: track.uri,
                      original_track_link: track.link,
                    },
                  ]);
                }
              }
            }
          }
          if (!isClean) {
            remainingExplicitSongs.push({
              name: track.name,
              queryURL: `https://open.spotify.com/search/${encodeURIComponent(
                track.query
              )}`,
            });
            if (!shouldExplicitify) {
              cleanVersionTrackIDs.push(track.uri);
            }
          }
        }
        setMixerProgress((index / total) * 100);
      }

      setSongsToResolve(potentiallyCleanSongs);

      console.log(`PlayLIst: ${playlists.items[checkedPlaylist].name}`);

      const newPlaylist = await createPlaylist(
        `${playlists.items[checkedPlaylist].name} (${
          shouldExplicitify ? "All Clean" : "Explicit"
        })`,
        user.id
      );
      setPlaylists(await getPlaylists());

      let allCleanSongs = [...cleanTrackIDs, ...cleanVersionTrackIDs];
      let remainingSongs = [];

      while (allCleanSongs.length > 0) {
        remainingSongs = allCleanSongs.splice(0, 100);
        if (remainingSongs.length > 0) {
          await addTracksToPlaylist(newPlaylist.id, remainingSongs);
        }
      }

      setisMixerLoading({
        numOriginalClean: cleanTrackIDs.length,
        numCleanFound: cleanVersionTrackIDs.length,
        numStillMissing: remainingExplicitSongs,
      });
      setCheckedPlaylist(String(Number(checkedPlaylist) + 1));
      setCleanedPlaylistID(newPlaylist.id);
      setMixerStatus(false);
      toast({
        title: `${shouldExplicitify ? "Cleanified" : "Explicitified"} Playlist`,
        position: "top",
        status: "success",
        duration: 4000,
        isClosable: true,
      });
    } catch (e) {
      console.log("Error converting", e);
      toast({
        title: `Error while converting. Your playlist may be too big. Refresh and try again`,
        position: "top",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return isLoading ? (
    <></>
  ) : (
    <Box>
      <Header username={user && user.display_name} />
      <Flex align="center" justify="center" p={[0, 1, 15, 15]}>
        <VStack mb={5}>
          {user && (
            <Heading size={"sm"} pb={2}>
              Select a Playlist to Convert
              <Icon cursor="pointer" ml={2} onClick={onExplainOpen} />
              <ExplainModal onClose={onExplainClose} isOpen={isExplainOpen} />
            </Heading>
          )}
          {user && (
            <SimpleGrid spacing={[1, 3, 5, 5]} columns={[1, 2, 3, 3]}>
              <Button
                isLoading={mixerStatus && wantedExplicit}
                bgColor={"#36b864"}
                _hover={{ bgImg: "linear-gradient(rgba(0, 0, 0, 0.4) 0 0)" }}
                color="white"
                onClick={() => handleMixer(true)}
                loadingText="Mixering"
                isDisabled={
                  !checkedPlaylist ||
                  gettingTracks ||
                  (mixerStatus && !wantedExplicit)
                }
              >
                Generate Playlist
              </Button>

              <Button
                isLoading={mixerStatus && !wantedExplicit}
                bgColor={"teal.700"}
                _hover={{ bgImg: "linear-gradient(rgba(0, 0, 0, 0.4) 0 0)" }}
                color="white"
                onClick={() => handleMixer(false)}
                loadingText="Explicitifying"
                isDisabled={
                  !checkedPlaylist ||
                  gettingTracks ||
                  (mixerStatus && wantedExplicit)
                }
              >
                Edit Playlist
              </Button>

              <Button
                colorScheme="red"
                onClick={handleDelete}
                isLoading={deleteStatus}
                loadingText="Deleting"
                isDisabled={!checkedPlaylist || mixerStatus || gettingTracks}
              >
                Delete Playlist
              </Button>

              {cleanedPlaylistID && (
                <Button isDisabled={!cleanedPlaylistID} onClick={onSummaryOpen}>
                  View Summary
                </Button>
              )}
              {cleanedPlaylistID && songsToResolve.size !== 0 && (
                <Button
                  isDisabled={songsToResolve.size === 0}
                  colorScheme="yellow"
                  onClick={onResolveOpen}
                >
                  Resolve Conflicts
                </Button>
              )}
            </SimpleGrid>
          )}
          {isMixerLoading && (
            <SummaryModal
              isOpen={isSummaryOpen}
              onClose={onSummaryClose}
              details={isMixerLoading}
              type={wantedExplicit ? "clean" : "explicit"}
              notType={!wantedExplicit ? "clean" : "explicit"}
            />
          )}
          {songsToResolve && (
            <ConflictModal
              isOpen={isResolveOpen}
              onClose={onResolveClose}
              details={songsToResolve}
              type={!wantedExplicit ? "explicit" : "clean"}
              notType={wantedExplicit ? "explicit" : "clean"}
            />
          )}
          <SimpleGrid
            pt={7}
            columns={[1, 1, 1, 3]}
            alignItems="center"
            spacing={5}
          >
            <Container
              mt={[1, 1, 1, 1]}
              mb={[20, 1, 1, 1]}
              h="700px"
              width={["300px", "300px", "350px"]}
            >
              {user && <PlaylistTable />}
            </Container>
            {checkedPlaylist && (
              <Container
                mt={[1, 1, 1, 1]}
                mb={[20, 1, 1, 1]}
                h="700px"
                width={["300px", "300px", "350px"]}
              >
                {checkedPlaylist && (
                  <SongTable
                    title={`Before ${
                      tracks ? `(${tracks.items.length} songs)` : ""
                    }`}
                  />
                )}
              </Container>
            )}
            {((checkedPlaylist && mixerProgress) ||
              (checkedPlaylist && cleanedPlaylistID)) && (
              <Container
                mt={[1, 1, 1, 1]}
                mb={[20, 1, 1, 1]}
                h="700px"
                width={["300px", "300px", "350px"]}
              >
                {checkedPlaylist && cleanedPlaylistID ? (
                  <CleanSongTable
                    title={`After (${
                      isMixerLoading.numCleanFound +
                      isMixerLoading.numOriginalClean
                    } songs)`}
                  />
                ) : (
                  mixerProgress &&
                  mixerProgress !== 100 && (
                    <Center h="700px" flexDir="column">
                      <ProgressBar value={mixerProgress} />
                    </Center>
                  )
                )}
              </Container>
            )}
          </SimpleGrid>
        </VStack>
      </Flex>
    </Box>
  );
};

export default Home;
