import { Text } from "@chakra-ui/layout";
import { AUTH_ENDPOINT } from "../utils/Constants";
import {
  Button,
  Box,
  Icon,
  Image,
  Stack,
  useColorModeValue,
  chakra,
} from "@chakra-ui/react";
import MixerHomePage from "../assets/HomePage.jpg";
import Header from "../components/Header";

function Login() {
  const handleLogin = () => {
    const logout = localStorage.getItem("logout");
    JSON.parse(logout) === true
      ? (window.location.href = `${AUTH_ENDPOINT}&show_dialog=true`)
      : (window.location.href = AUTH_ENDPOINT);
    localStorage.setItem("logout", false);
  };
  return (
    <Box>
      <Header />

      <Box px={8} py={8} mx="auto">
        <Box
          w={{ base: "full", md: 11 / 12, xl: 9 / 12 }}
          mx="auto"
          textAlign={{ base: "left", md: "center" }}
        >
          <chakra.h1
            mb={6}
            fontSize={{ base: "3xl", md: "5xl" }}
            fontWeight="bold"
            lineHeight="none"
            letterSpacing={{ base: "normal", md: "tight" }}
            color={useColorModeValue("gray.900", "gray.100")}
          >
            Create{" "}
            <Text
              display={{ base: "block", lg: "inline" }}
              w="full"
              bgClip="text"
              bgGradient="linear(to-r, #36b864,#1a411e)"
              fontWeight="extrabold"
            >
              Spotify Playlists
            </Text>{" "}
            the easy way.
          </chakra.h1>
          <chakra.p
            px={{ base: 0, lg: 24 }}
            mb={6}
            fontSize={{ base: "lg", md: "xl" }}
            color={useColorModeValue("gray.600", "gray.300")}
          >
            Mixer allows you to easily create or edit versions of your Spotify
            playlists
          </chakra.p>
          <Stack
            direction={{ base: "column", sm: "row" }}
            mb={{ base: 4, md: 8 }}
            spacing={2}
            justifyContent={{ sm: "left", md: "center" }}
          >
            <Button
              as="a"
              variant="solid"
              bgColor="#36b864"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              w={{ base: "full", sm: "auto" }}
              mb={{ base: 2, sm: 0 }}
              size="lg"
              cursor="pointer"
              textColor={"white"}
              _hover={{ bgImg: "linear-gradient(rgba(0, 0, 0, 0.4) 0 0)" }}
              onClick={handleLogin}
            >
              Login with Spotify
              <Icon boxSize={4} ml={1} viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </Icon>
            </Button>
          </Stack>
        </Box>
        <Box
          w={{ base: "full", md: 10 / 12 }}
          mx="auto"
          mt={20}
          textAlign="center"
        >
          <Image
            w="full"
            rounded="lg"
            shadow="2xl"
            src={MixerHomePage}
            alt="Mixer Home Page screenshot"
          />
        </Box>
      </Box>
    </Box>
  );
}

export default Login;
